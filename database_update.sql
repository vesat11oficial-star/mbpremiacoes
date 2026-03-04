-- 1. Habilitar RLS (Segurança a nível de linha) em todas as tabelas
ALTER TABLE raffles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE winning_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE banners ENABLE ROW LEVEL SECURITY;

-- 2. Políticas de Acesso (Policies)
-- Removemos políticas antigas antes de criar novas para evitar erros de duplicidade

-- RAFFLES
DROP POLICY IF EXISTS "Public Read Raffles" ON raffles;
CREATE POLICY "Public Read Raffles" ON raffles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin All Raffles" ON raffles;
CREATE POLICY "Admin All Raffles" ON raffles FOR ALL USING (auth.role() = 'authenticated');

-- BANNERS
DROP POLICY IF EXISTS "Public Read Banners" ON banners;
CREATE POLICY "Public Read Banners" ON banners FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin All Banners" ON banners;
CREATE POLICY "Admin All Banners" ON banners FOR ALL USING (auth.role() = 'authenticated');

-- TICKETS
DROP POLICY IF EXISTS "Public Read Tickets" ON tickets;
CREATE POLICY "Public Read Tickets" ON tickets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin All Tickets" ON tickets;
CREATE POLICY "Admin All Tickets" ON tickets FOR ALL USING (auth.role() = 'authenticated');

-- WINNING TICKETS
DROP POLICY IF EXISTS "Public Read Winning Tickets" ON winning_tickets;
CREATE POLICY "Public Read Winning Tickets" ON winning_tickets FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin All Winning Tickets" ON winning_tickets;
CREATE POLICY "Admin All Winning Tickets" ON winning_tickets FOR ALL USING (auth.role() = 'authenticated');

-- PURCHASES
DROP POLICY IF EXISTS "Public Insert Purchases" ON purchases;
CREATE POLICY "Public Insert Purchases" ON purchases FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Own Purchases" ON purchases;
CREATE POLICY "Public Read Own Purchases" ON purchases FOR SELECT USING (true); 

DROP POLICY IF EXISTS "Admin All Purchases" ON purchases;
CREATE POLICY "Admin All Purchases" ON purchases FOR ALL USING (auth.role() = 'authenticated');

-- 3. Função RPC Segura para Compra de Bilhetes
-- Esta função substitui a lógica do frontend, rodando dentro do banco de dados

CREATE OR REPLACE FUNCTION buy_tickets(
  p_raffle_id UUID,
  p_quantity INT,
  p_name TEXT,
  p_cpf TEXT,
  p_phone TEXT,
  p_total_value DECIMAL
) 
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER -- Roda com permissões de admin (para poder inserir tickets)
AS $$
DECLARE
  v_raffle RECORD;
  v_purchase_id UUID;
  v_generated_numbers INT[];
  v_candidate INT;
  v_count INT := 0;
  v_max_attempts INT := 0;
  v_blocked_numbers INT[];
  v_won_prizes JSONB := '[]'::jsonb;
  v_winning_ticket RECORD;
BEGIN
  -- 1. Validar Rifa
  SELECT * INTO v_raffle FROM raffles WHERE id = p_raffle_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'message', 'Rifa não encontrada');
  END IF;

  IF v_raffle.status <> 'ACTIVE' THEN
     RETURN json_build_object('success', false, 'message', 'Rifa finalizada ou inativa');
  END IF;

  -- Validar quantidade disponível (estimativa rápida)
  IF (SELECT count(*) FROM tickets WHERE raffle_id = p_raffle_id) + p_quantity > v_raffle.total_numbers THEN
     RETURN json_build_object('success', false, 'message', 'Quantidade de cotas indisponível');
  END IF;

  -- 2. Identificar números bloqueados (Cotas premiadas travadas)
  SELECT array_agg(ticket_number) INTO v_blocked_numbers 
  FROM winning_tickets 
  WHERE raffle_id = p_raffle_id AND is_active = false AND is_sold = false;

  -- 3. Gerar Números Aleatórios Únicos
  -- Loop até encontrar a quantidade desejada de números livres
  WHILE v_count < p_quantity AND v_max_attempts < (p_quantity * 20) LOOP
      v_max_attempts := v_max_attempts + 1;
      
      -- Gera número randomico entre 0 e total-1
      v_candidate := floor(random() * v_raffle.total_numbers)::INT;

      -- Verifica se já escolhemos este número nesta transação
      IF v_candidate = ANY(v_generated_numbers) THEN
        CONTINUE;
      END IF;

      -- Verifica se é um número bloqueado (Cadeado Fechado)
      IF v_blocked_numbers IS NOT NULL AND v_candidate = ANY(v_blocked_numbers) THEN
        CONTINUE;
      END IF;

      -- Verifica se já existe no banco (Performático)
      PERFORM 1 FROM tickets WHERE raffle_id = p_raffle_id AND number = v_candidate;
      IF NOT FOUND THEN
        v_generated_numbers := array_append(v_generated_numbers, v_candidate);
        v_count := v_count + 1;
      END IF;
  END LOOP;

  IF array_length(v_generated_numbers, 1) < p_quantity THEN
    RETURN json_build_object('success', false, 'message', 'Não foi possível encontrar números consecutivos disponíveis. Tente uma quantidade menor.');
  END IF;

  -- Ordenar números (opcional, para estética)
  SELECT array_agg(x ORDER BY x) INTO v_generated_numbers FROM unnest(v_generated_numbers) x;

  -- 4. Inserir Compra
  INSERT INTO purchases (raffle_id, name, cpf, phone, quantity, total_value, purchase_date)
  VALUES (p_raffle_id, p_name, p_cpf, p_phone, p_quantity, p_total_value, NOW())
  RETURNING id INTO v_purchase_id;

  -- 5. Inserir Bilhetes (Batch Insert)
  INSERT INTO tickets (raffle_id, purchase_id, number, owner_cpf)
  SELECT p_raffle_id, v_purchase_id, unnest(v_generated_numbers), p_cpf;

  -- 6. Verificar Ganhadores Instantâneos (Cotas Premiadas)
  FOR v_winning_ticket IN 
    SELECT * FROM winning_tickets 
    WHERE raffle_id = p_raffle_id 
    AND is_active = true 
    AND is_sold = false 
    AND ticket_number = ANY(v_generated_numbers)
  LOOP
      -- Marcar como vendido
      UPDATE winning_tickets 
      SET is_sold = true, purchase_id = v_purchase_id, winner_cpf = p_cpf, winner_name = p_name
      WHERE id = v_winning_ticket.id;

      -- Adicionar ao JSON de resposta
      v_won_prizes := v_won_prizes || jsonb_build_object(
        'number', v_winning_ticket.ticket_number, 
        'prize', v_winning_ticket.prize_description
      );
  END LOOP;

  -- 7. Retornar Sucesso
  RETURN json_build_object(
    'success', true, 
    'numbers', v_generated_numbers,
    'wonPrizes', v_won_prizes
  );
END;
$$;

-- 8. Função para Simulação de Reserva Expirada (Marketing)
CREATE OR REPLACE FUNCTION get_simulation_numbers(
  p_raffle_id UUID,
  p_quantity INT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_raffle_total INT;
  v_winning_number INT := NULL;
  v_generated_numbers INT[] := ARRAY[]::INT[];
  v_candidate INT;
  v_count INT := 0;
  v_max_attempts INT := 0;
  v_has_winner BOOLEAN := false;
BEGIN
  -- Get total numbers
  SELECT total_numbers INTO v_raffle_total FROM raffles WHERE id = p_raffle_id;
  
  -- 1. Try to find an unsold winning ticket
  SELECT ticket_number INTO v_winning_number
  FROM winning_tickets
  WHERE raffle_id = p_raffle_id AND is_sold = false
  ORDER BY random()
  LIMIT 1;

  IF v_winning_number IS NOT NULL THEN
    v_generated_numbers := array_append(v_generated_numbers, v_winning_number);
    v_count := 1;
    v_has_winner := true;
  END IF;

  -- 2. Fill the rest
  WHILE v_count < p_quantity AND v_max_attempts < (p_quantity * 100) LOOP
      v_max_attempts := v_max_attempts + 1;
      v_candidate := floor(random() * v_raffle_total)::INT;

      -- Check if already in our generated list
      IF v_candidate = ANY(v_generated_numbers) THEN
        CONTINUE;
      END IF;

      -- Check if sold (exists in tickets table)
      PERFORM 1 FROM tickets WHERE raffle_id = p_raffle_id AND number = v_candidate;
      IF FOUND THEN
        CONTINUE;
      END IF;
      
      v_generated_numbers := array_append(v_generated_numbers, v_candidate);
      v_count := v_count + 1;
  END LOOP;

  -- Sort for better display
  SELECT array_agg(x ORDER BY x) INTO v_generated_numbers FROM unnest(v_generated_numbers) x;

  RETURN json_build_object(
    'numbers', v_generated_numbers,
    'winningNumber', v_winning_number
  );
END;
$$;