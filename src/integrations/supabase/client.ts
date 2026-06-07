import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://vntnbjcwwgloprxsfpzc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZudG5iamN3d2dsb3ByeHNmcHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2OTQwODIsImV4cCI6MjA5MTI3MDA4Mn0.q8j7Mb69SPtr9jXdkJdcAeLzIJdPIxnJRFqadAgeHT8";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
