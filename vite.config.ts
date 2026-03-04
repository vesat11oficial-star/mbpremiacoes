import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fetch from 'node-fetch';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// Sopay Credentials
const SOPAY_API_URL = 'https://api.sopaybr.com/api';
const SOPAY_CLIENT_ID = process.env.SOPAY_CLIENT_ID || 'gabrieldelimasantanasantos_AEEA6136';
const SOPAY_CLIENT_SECRET = process.env.SOPAY_CLIENT_SECRET || '9eed561eece5c08e642fa2371e8c2820356bf21d7ded1e7ac29ec955362cc0c4cc716719b479fc8364727533e7ecc070f35f';

console.log('Sopay Config:', { 
  SOPAY_CLIENT_ID, 
  hasSecret: !!SOPAY_CLIENT_SECRET,
  envKeys: Object.keys(process.env).filter(k => k.includes('SOPAY'))
});

const WEBHOOK_URL = 'https://zbaaopdndnlckuornird.supabase.co/functions/v1/sopay-webhook';

// Supabase Credentials
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://zbaaopdndnlckuornird.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseClient: any = null;
const getSupabase = () => {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || '');
  }
  return supabaseClient;
};

let cachedToken: string | null = null;
let tokenExpiry: number = 0;

const getSopayToken = async () => {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiry) return cachedToken;

  console.log(`[Sopay] Tentando autenticar em: ${SOPAY_API_URL}`);

  try {
    const response = await fetch(`${SOPAY_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: SOPAY_CLIENT_ID, client_secret: SOPAY_CLIENT_SECRET }),
    });

    const data: any = await response.json();
    
    if (data.access_token) {
      console.log(`[Sopay] Autenticação bem-sucedida!`);
      cachedToken = data.access_token;
      tokenExpiry = now + (data.expires_in || 3600) - 60;
      return cachedToken;
    }

    console.error(`[Sopay] Erro de resposta:`, data);
    throw new Error(`Falha na autenticação Sopay: ${data.message || data.error || JSON.stringify(data)}`);
  } catch (err: any) {
    console.error(`[Sopay] Erro de conexão:`, err.message);
    throw new Error(`Erro ao conectar com Sopay: ${err.message}`);
  }
};

const findPixKey = (obj: any): string | null => {
  if (typeof obj === "string" && obj.startsWith("000201")) return obj;
  if (typeof obj === "object" && obj !== null) {
    for (const key in obj) {
      const result = findPixKey(obj[key]);
      if (result) return result;
    }
  }
  return null;
};

const normalizeStatus = (status: string): string => {
  const s = status?.toUpperCase().trim();
  if (s === "FALIED") return "FAILED";
  return s;
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'sopay-api',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith('/api/')) return next();

          try {
            // 1. Create Deposit
            if (req.url === '/api/payments/create-deposit' && req.method === 'POST') {
              let body = '';
              req.on('data', chunk => { body += chunk; });
              req.on('end', async () => {
                try {
                  const { amount, name, email, document, external_id } = JSON.parse(body);
                  const token = await getSopayToken();
                  const response = await fetch(`${SOPAY_API_URL}/payments/deposit`, {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      amount, external_id, clientCallbackUrl: WEBHOOK_URL,
                      payer: { name, email: email || 'cliente@email.com', document: document.replace(/\D/g, '') }
                    }),
                  });
                  const data: any = await response.json();
                  const pixKey = findPixKey(data);
                  if (!pixKey) throw new Error('Failed to generate PIX key');

                  await getSupabase().from('deposits').insert({
                    external_id, transaction_id: data.transaction_id || data.id || 'unknown', amount, status: 'PENDING'
                  });

                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    success: true, pix_key: pixKey, transaction_id: data.transaction_id || data.id,
                    qr_code: data.qr_code || `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(pixKey)}`
                  }));
                } catch (err: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                }
              });
              return;
            }

            // 2. Check Status
            if (req.url.startsWith('/api/payments/status/') && req.method === 'GET') {
              const transaction_id = req.url.split('/').pop();
              const token = await getSopayToken();
              const response = await fetch(`${SOPAY_API_URL}/transactions/getStatusTransac/${transaction_id}`, {
                method: 'GET',
                headers: { 'Authorization': `Bearer ${token}` },
              });
              const data: any = await response.json();
              const status = normalizeStatus(data.status || data.payment_status || 'PENDING');
              if (status === 'COMPLETED') {
                await getSupabase().from('deposits').update({ status: 'COMPLETED', updated_at: new Date().toISOString() }).eq('transaction_id', transaction_id);
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status }));
              return;
            }

            // 3. Health Check
            if (req.url === '/api/health') {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
              return;
            }

          } catch (error: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: error.message }));
            return;
          }

          next();
        });
      }
    }
  ],
  server: {
    port: 3000,
    host: '0.0.0.0',
    strictPort: true,
  },
});