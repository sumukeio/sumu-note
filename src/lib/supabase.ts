import { createClient } from '@supabase/supabase-js'
import type { AuthError } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'supabase.auth.token',
  },
})

/**
 * 检查是否是 refresh token 相关的错误
 * 如果是，则清除 session 并返回 true
 */
export async function handleAuthError(error: AuthError | null | undefined): Promise<boolean> {
  if (!error) return false;
  
  const errorMessage = error.message || '';
  const isRefreshTokenError = 
    errorMessage.includes("Refresh Token") || 
    errorMessage.includes("JWT") ||
    errorMessage.includes("Invalid Refresh Token") ||
    errorMessage.includes("Refresh Token Not Found");
  
  if (isRefreshTokenError) {
    console.warn("Refresh token error detected, signing out:", errorMessage);
    await supabase.auth.signOut();
    return true;
  }
  
  return false;
}