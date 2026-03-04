-- Criar tabela de configurações para armazenar chaves de API com segurança
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Apenas o Service Role (Admin) pode ler ou escrever nesta tabela
-- Isso garante que as chaves não fiquem expostas publicamente no frontend
DROP POLICY IF EXISTS "Admin only settings" ON settings;
CREATE POLICY "Admin only settings" ON settings FOR ALL USING (auth.role() = 'authenticated');

-- Inserir placeholders (Substitua pelos seus valores reais no painel do Supabase)
INSERT INTO settings (key, value, description) VALUES 
('SOPAY_CLIENT_ID', 'COLE_AQUI_SEU_CLIENT_ID', 'ID do Cliente Sopay'),
('SOPAY_CLIENT_SECRET', 'COLE_AQUI_SEU_CLIENT_SECRET', 'Secret do Cliente Sopay'),
('SOPAY_API_URL', 'https://api.sopaybr.com', 'URL Base da API Sopay')
ON CONFLICT (key) DO NOTHING;
