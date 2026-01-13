import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn utility function', () => {
  it('should merge class names correctly', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    const isActive = true;
    const result = cn('base', isActive && 'active', 'always');
    expect(result).toContain('base');
    expect(result).toContain('active');
    expect(result).toContain('always');
  });

  it('should handle falsy values', () => {
    const result = cn('foo', false && 'bar', null, undefined, 'baz');
    expect(result).toBe('foo baz');
  });

  it('should merge Tailwind classes correctly', () => {
    // tailwind-merge should handle conflicting classes
    const result = cn('px-2 px-4', 'py-2');
    expect(result).toContain('px-4'); // px-4 should override px-2
    expect(result).toContain('py-2');
  });

  it('should handle empty input', () => {
    const result = cn();
    expect(result).toBe('');
  });

  it('should handle arrays', () => {
    const result = cn(['foo', 'bar'], 'baz');
    expect(result).toContain('foo');
    expect(result).toContain('bar');
    expect(result).toContain('baz');
  });
});






























