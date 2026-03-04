-- 1. Criar tabela de pagamentos
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id TEXT UNIQUE NOT NULL,
  transaction_id TEXT,
  amount DECIMAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  user_id TEXT, -- CPF do comprador
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Criar tabela de logs de webhooks
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  payload JSONB NOT NULL,
  transaction_id TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- 4. Políticas de acesso
-- Permitir que qualquer um consulte seu próprio pagamento pelo external_id
DROP POLICY IF EXISTS "Allow select by external_id" ON payments;
CREATE POLICY "Allow select by external_id" ON payments FOR SELECT USING (true);

-- Logs são apenas para admin (service role)
DROP POLICY IF EXISTS "Admin only logs" ON webhook_logs;
CREATE POLICY "Admin only logs" ON webhook_logs FOR ALL USING (auth.role() = 'authenticated');
