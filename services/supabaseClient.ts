import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://zbaaopdndnlckuornird.supabase.co';
const SUPABASE_KEY = 'sb_publishable_SRRnHsdPThAGzWWQgQNkhQ_e-3v6l_v';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);