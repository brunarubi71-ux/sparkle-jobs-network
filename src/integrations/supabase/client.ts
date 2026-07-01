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
    // PKCE flow: more secure and compatible with browser extensions that
    // block hash-fragment tokens (implicit flow). The OAuth callback lands
    // on /auth/callback where Supabase exchanges the code for a session.
    flowType: 'pkce',
    // detectSessionInUrl: false so that AuthProvider's getSession() does NOT
    // auto-consume the one-time PKCE code from the URL. Only AuthCallback
    // calls exchangeCodeForSession() explicitly, avoiding a race condition
    // where two concurrent getSession() calls compete for the same code.
    detectSessionInUrl: false,
  }
});
