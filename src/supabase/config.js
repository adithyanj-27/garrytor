import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl !== 'your-supabase-project-url' &&
  supabaseAnonKey !== 'your-supabase-anon-key';

if (!isConfigured) {
  console.warn(
    'Supabase URL or Anon Key is missing or invalid. Please add them to your .env file. ' +
    'Local dummy storage and fallback mock mode will be used for testing UI.'
  );
}

// Only call createClient if keys are actually present to prevent runtime crashes
export const supabase = isConfigured 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
