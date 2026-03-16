import { createClient } from '@supabase/supabase-js'
import type { AuthError } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

type StorageLike = {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
  removeItem: (key: string) => void
}

function createSafeStorage(): StorageLike | undefined {
  if (typeof window === 'undefined') return undefined

  const memory = new Map<string, string>()
  const canUseLocalStorage = (() => {
    try {
      const k = '__sumu_ls_test__'
      window.localStorage.setItem(k, '1')
      window.localStorage.removeItem(k)
      return true
    } catch {
      return false
    }
  })()

  if (canUseLocalStorage) {
    return {
      getItem: (key) => {
        try {
          return window.localStorage.getItem(key)
        } catch {
          return memory.get(key) ?? null
        }
      },
      setItem: (key, value) => {
        try {
          window.localStorage.setItem(key, value)
        } catch {
          memory.set(key, value)
        }
      },
      removeItem: (key) => {
        try {
          window.localStorage.removeItem(key)
        } catch {
          memory.delete(key)
        }
      },
    }
  }

  // localStorage 不可用时，退化为内存存储（会话仅在当前标签页有效）
  return {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  }
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: createSafeStorage(),
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