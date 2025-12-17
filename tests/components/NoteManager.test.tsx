import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import NoteManager from '@/components/NoteManager';
import { supabase } from '@/lib/supabase';

// Mock supabase
vi.mock('@/lib/supabase');

describe('NoteManager Component', () => {
  const mockUserId = 'user-123';
  const mockFolderId = 'folder-123';
  const mockFolderName = '测试文件夹';
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    // 创建链式调用的mock
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockOr = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    
    const mockFrom = vi.fn(() => ({
      select: mockSelect,
      eq: mockEq,
      or: mockOr,
      order: mockOrder,
    }));

    vi.mocked(supabase.from).mockImplementation(mockFrom);
  });

  it('should display folder name in header', () => {
    render(
      <NoteManager
        userId={mockUserId}
        folderId={mockFolderId}
        folderName={mockFolderName}
        onBack={mockOnBack}
      />
    );
    
    expect(screen.getByText(mockFolderName)).toBeInTheDocument();
  });

  it('should show empty state when no notes', async () => {
    render(
      <NoteManager
        userId={mockUserId}
        folderId={mockFolderId}
        folderName={mockFolderName}
        onBack={mockOnBack}
      />
    );
    
    // 等待数据加载完成
    await new Promise(resolve => setTimeout(resolve, 100));
    
    expect(screen.getByText(/空空如也/i)).toBeInTheDocument();
  });
});
