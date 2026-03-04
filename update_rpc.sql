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
