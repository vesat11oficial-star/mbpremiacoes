import React, { useState } from 'react';
import { X, QrCode, Copy, Check, Loader2, AlertCircle, User } from 'lucide-react';
import { Raffle } from '../types';
import { raffleService } from '../services/raffleService';

interface CheckoutModalProps {
  raffle: Raffle;
  quantity: number;
  onClose: () => void;
  onSuccess: (numbers: number[], wonPrizes?: { number: number; prize: string }[]) => void;
}

enum CheckoutStep {
  FORM = 'FORM',
  PAYMENT = 'PAYMENT',
  PROCESSING = 'PROCESSING'
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({ raffle, quantity, onClose, onSuccess }) => {
  const [step, setStep] = useState<CheckoutStep>(CheckoutStep.FORM);
  const [name, setName] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pixData, setPixData] = useState<{ qrcode?: string; payload?: string; external_id?: string } | null>(null);

  const totalValue = quantity * raffle.pricePerNumber;

  // Listen for payment completion via Supabase Realtime
  React.useEffect(() => {
    if (!pixData?.external_id) return;

    const channel = raffleService.subscribeToPayment(pixData.external_id, (payload) => {
      if (payload.new.status === 'COMPLETED') {
        handleConfirmPayment();
      }
    });

    return () => {
      raffleService.unsubscribeFromPayment(channel);
    };
  }, [pixData?.external_id]);

  // --- Formatters ---
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Permite apenas letras (com acentos) e espaços
    const value = e.target.value.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ\s]/g, '');
    setName(value);
  };

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    // Máscara 000.000.000-00
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    
    setCpf(value);
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 11) value = value.slice(0, 11);
    
    // Máscara (00) 00000-0000
    if (value.length > 10) {
      value = value.replace(/^(\d{2})(\d{5})(\d{4}).*/, '($1) $2-$3');
    } else if (value.length > 5) {
      value = value.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3');
    } else if (value.length > 2) {
      value = value.replace(/^(\d{2})(\d{0,5}).*/, '($1) $2');
    }
    
    setPhone(value);
  };

  const handleGeneratePix = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || cpf.length < 14 || phone.length < 14) {
      setError('Por favor preencha todos os dados corretamente.');
      return;
    }

    setError(null);
    setStep(CheckoutStep.PROCESSING);

    try {
      const response = await fetch('/api/payments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: totalValue,
          userId: cpf.replace(/\D/g, ''),
          raffleId: raffle.id,
          quantity: quantity,
          payer: {
            name,
            email: `${cpf.replace(/\D/g, '')}@example.com`, // Email is required by Sopay, using a placeholder
            document: cpf.replace(/\D/g, ''),
            phone: phone.replace(/\D/g, '')
          }
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao gerar PIX. Tente novamente.');
      }

      const data = await response.json();
      setPixData({
        qrcode: data.pix_qrcode,
        payload: data.pix_payload,
        external_id: data.external_id
      });
      setStep(CheckoutStep.PAYMENT);
    } catch (err: any) {
      setError(err.message || 'Erro ao conectar com o servidor.');
      setStep(CheckoutStep.FORM);
    }
  };

  const handleConfirmPayment = async () => {
    setStep(CheckoutStep.PROCESSING);
    try {
      // Since the webhook already called buy_tickets, we just need to fetch the results
      // Or we can just wait for the user to be redirected.
      // Let's call a method that checks if the purchase was already created for this CPF/Raffle
      const result = await raffleService.getPurchaseByExternalId(pixData?.external_id || '');
      
      if (result) {
        onSuccess(result.ticketNumbers, []); // wonPrizes might be empty or we could fetch them
      } else {
        // Fallback: try to call purchaseTickets directly if webhook failed (though webhook is preferred)
        // For now, let's just show an error if it's not found yet
        setError('Pagamento confirmado, mas os números ainda estão sendo gerados. Por favor, aguarde ou verifique "Meus Bilhetes".');
        setStep(CheckoutStep.PAYMENT);
      }
    } catch (err) {
      setError('Erro ao validar pagamento. Verifique "Meus Bilhetes" em instantes.');
      setStep(CheckoutStep.FORM);
    }
  };

  const copyPix = () => {
    if (pixData?.payload) {
      navigator.clipboard.writeText(pixData.payload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors"
        >
          <X size={24} />
        </button>

        <div className="p-6">
          <h2 className="text-2xl font-bold text-white mb-1">Finalizar Compra</h2>
          <p className="text-zinc-400 text-sm mb-6">
            Você está comprando <strong className="text-yellow-500">{quantity} cotas</strong> da rifa <span className="text-white">{raffle.name}</span>
          </p>

          {step === CheckoutStep.FORM && (
            <form onSubmit={handleGeneratePix} className="space-y-4">
               {error && (
                <div className="p-3 bg-red-900/30 border border-red-800 rounded-lg text-red-200 text-sm flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Nome Completo</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                  <input
                    type="text"
                    required
                    placeholder="Seu nome"
                    value={name}
                    onChange={handleNameChange}
                    className="w-full bg-black border border-zinc-800 rounded-lg pl-10 pr-4 py-3 text-white focus:border-yellow-600 focus:ring-1 focus:ring-yellow-600 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">CPF</label>
                <input
                  type="text"
                  required
                  placeholder="000.000.000-00"
                  value={cpf}
                  onChange={handleCpfChange}
                  maxLength={14}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-white focus:border-yellow-600 focus:ring-1 focus:ring-yellow-600 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">Telefone / WhatsApp</label>
                <input
                  type="tel"
                  required
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={15}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-white focus:border-yellow-600 focus:ring-1 focus:ring-yellow-600 outline-none transition-all"
                />
              </div>

              <div className="pt-4 border-t border-zinc-800 flex justify-between items-center">
                <span className="text-zinc-400">Total a pagar:</span>
                <span className="text-2xl font-bold text-yellow-500">R$ {totalValue.toFixed(2).replace('.', ',')}</span>
              </div>

              <button 
                type="submit"
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-green-900/20 active:scale-95 mt-4"
              >
                Gerar Pagamento Pix
              </button>
            </form>
          )}

          {step === CheckoutStep.PAYMENT && (
            <div className="flex flex-col items-center text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center text-green-500 mb-2">
                <QrCode size={32} />
              </div>
              
              <div>
                <h3 className="text-lg font-bold text-white">Escaneie o QR Code</h3>
                <p className="text-sm text-zinc-400">Abra o app do seu banco e pague via Pix.</p>
              </div>

              {/* Real QR Code */}
              <div className="bg-white p-2 rounded-lg">
                {pixData?.qrcode ? (
                  <img 
                    src={pixData.qrcode} 
                    alt="QR Code Pix" 
                    className="w-48 h-48"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-zinc-100 text-zinc-400">
                    <QrCode size={48} />
                  </div>
                )}
              </div>

              <div className="w-full">
                <p className="text-xs text-zinc-500 mb-2">Ou copie e cole o código abaixo:</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={pixData?.payload || "Carregando..."} 
                    className="flex-1 bg-black border border-zinc-800 rounded-lg px-3 py-2 text-zinc-400 text-sm truncate"
                  />
                  <button 
                    onClick={copyPix}
                    disabled={!pixData?.payload}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {copied ? <Check size={18} className="text-green-500" /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <div className="text-xs text-yellow-500/80 animate-pulse bg-yellow-900/10 px-4 py-2 rounded-full">
                Aguardando confirmação do pagamento...
              </div>
            </div>
          )}

          {step === CheckoutStep.PROCESSING && (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <Loader2 className="w-12 h-12 text-yellow-500 animate-spin" />
              <p className="text-lg font-medium text-white">Validando pagamento...</p>
              <p className="text-sm text-zinc-500">Isso leva apenas alguns segundos.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};