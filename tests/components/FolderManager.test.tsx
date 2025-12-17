import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FolderManager from '@/components/FolderManager';
import { supabase } from '@/lib/supabase';

// Mock supabase
vi.mock('@/lib/supabase');

describe('FolderManager Component', () => {
  const mockOnEnterFolder = vi.fn();
  const mockUserId = 'user-123';
  const mockFolders = [
    { id: 'folder-1', name: '工作', user_id: mockUserId, created_at: '2024-01-01' },
    { id: 'folder-2', name: '学习', user_id: mockUserId, created_at: '2024-01-02' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 创建链式调用的mock
    const mockOrder = vi.fn().mockResolvedValue({ data: mockFolders, error: null });
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    
    const mockFrom = vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      order: mockOrder,
    }));

    vi.mocked(supabase.from).mockImplementation(mockFrom);
  });

  it('should show create folder button', () => {
    render(<FolderManager userId={mockUserId} onEnterFolder={mockOnEnterFolder} />);
    
    expect(screen.getByText(/新建/i)).toBeInTheDocument();
  });

  it('should display folder count header', () => {
    render(<FolderManager userId={mockUserId} onEnterFolder={mockOnEnterFolder} />);
    
    expect(screen.getByText('我的文件夹')).toBeInTheDocument();
  });
});
