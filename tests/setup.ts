import '@testing-library/jest-dom';
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// 设置环境变量（用于Supabase客户端初始化）
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// 清理每个测试后的DOM
afterEach(() => {
  cleanup();
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock localforage
vi.mock('localforage', () => ({
  default: {
    config: vi.fn(() => Promise.resolve(null)),
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve(null)),
    removeItem: vi.fn(() => Promise.resolve(null)),
    clear: vi.fn(() => Promise.resolve(null)),
    keys: vi.fn(() => Promise.resolve([])),
  },
}));

// Mock Supabase client
vi.mock('@/lib/supabase', () => {
  // 通用的 query mock，对所有链式方法返回同一个对象，避免 .order(...).order(...) 类型错误
  const createQueryMock = () => {
    const query: any = {};
    query.select = vi.fn(() => query);
    query.insert = vi.fn(() => query);
    query.update = vi.fn(() => query);
    query.delete = vi.fn(() => query);
    query.eq = vi.fn(() => query);
    query.or = vi.fn(() => query);
    query.order = vi.fn(() => query);
    query.in = vi.fn(() => query);
    query.is = vi.fn(() => query);
    query.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
    // 默认返回空数组，避免组件一直加载
    query.then = vi.fn((resolve) => resolve({ data: [], error: null }));
    return query;
  };

  const supabaseMock = {
    auth: {
      getUser: vi.fn(),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(() => createQueryMock()),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.com/image.jpg' } })),
      })),
    },
  };

  return { supabase: supabaseMock };
});
