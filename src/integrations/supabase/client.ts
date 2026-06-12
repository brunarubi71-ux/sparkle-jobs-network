import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Usa variáveis de ambiente do build (Lovable/Vite).
// Os valores abaixo são fallback para desenvolvimento local sem .env configurado.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://vntnbjcwwgloprxsfpzc.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "sb_publishable_B4aMbIY6Ge99YWS-ImPOkg_-LwTNA2J";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
