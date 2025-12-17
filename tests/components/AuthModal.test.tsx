import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AuthModal from '@/components/AuthModal';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

// Mock router
vi.mock('next/navigation');
const mockPush = vi.fn();
const mockRouter = { push: mockPush, replace: vi.fn(), refresh: vi.fn() };
vi.mocked(useRouter).mockReturnValue(mockRouter as any);

describe('AuthModal Component', () => {
  const mockOnClose = vi.fn();
  const mockSignIn = vi.fn();
  const mockSignUp = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.auth.signInWithPassword).mockImplementation(mockSignIn);
    vi.mocked(supabase.auth.signUp).mockImplementation(mockSignUp);
  });

  it('should render login tab by default', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} defaultTab="login" />);
    
    expect(screen.getByText('登录')).toBeInTheDocument();
    expect(screen.getByText('注册')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('name@example.com')).toBeInTheDocument();
  });

  it('should render register tab when defaultTab is register', () => {
    render(<AuthModal isOpen={true} onClose={mockOnClose} defaultTab="register" />);
    
    const registerButton = screen.getByRole('button', { name: /免费注册/i });
    expect(registerButton).toBeInTheDocument();
  });

  it('should switch between login and register tabs', async () => {
    const user = userEvent.setup();
    render(<AuthModal isOpen={true} onClose={mockOnClose} defaultTab="login" />);
    
    const registerTab = screen.getByText('注册');
    await user.click(registerTab);
    
    expect(screen.getByRole('button', { name: /免费注册/i })).toBeInTheDocument();
  });
});
