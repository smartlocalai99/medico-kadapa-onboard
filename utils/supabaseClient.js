import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  console.warn('Supabase URL or Publishable Key is missing in environment variables.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
