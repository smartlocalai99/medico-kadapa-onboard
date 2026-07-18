import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jlvjnnltynebenflkcua.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_LXzMM6HjPlwUmbMQfqyYXw_QthfwjsU';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  console.warn('Supabase credentials missing at build time. Using project default fallbacks.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
