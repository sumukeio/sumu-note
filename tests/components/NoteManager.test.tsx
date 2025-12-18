import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import NoteManager from '@/components/NoteManager';

describe('NoteManager Component', () => {
  const mockUserId = 'user-123';
  const mockFolderId = 'folder-123';
  const mockFolderName = '测试文件夹';
  const mockOnBack = vi.fn();

  it('should display folder name in header', async () => {
    render(
      <NoteManager
        userId={mockUserId}
        folderId={mockFolderId}
        folderName={mockFolderName}
        onBack={mockOnBack}
      />
    );
    
    expect(await screen.findByText(mockFolderName)).toBeInTheDocument();
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
    
    // 等待数据加载完成并显示空状态
    expect(await screen.findByText(/空空如也/i)).toBeInTheDocument();
  });
});
