import { createClient } from "@supabase/supabase-js";

// Supabase SQL to run once (in the Supabase SQL editor):
// create policy "allow select aggregate" on public.matrix_sessions for select using (true);
// create policy "allow select" on public.reflections for select using (true);

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
