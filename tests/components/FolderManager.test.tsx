import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import FolderManager from '@/components/FolderManager';

describe('FolderManager Component', () => {
  const mockOnEnterFolder = vi.fn();
  const mockUserId = 'user-123';

  it('should show create folder button', async () => {
    render(<FolderManager userId={mockUserId} onEnterFolder={mockOnEnterFolder} />);
    // 等待加载结束后出现“新建”按钮
    expect(await screen.findByText(/新建/i)).toBeInTheDocument();
  });

  it('should display folder count header', async () => {
    render(<FolderManager userId={mockUserId} onEnterFolder={mockOnEnterFolder} />);
    expect(await screen.findByText('我的文件夹')).toBeInTheDocument();
  });
});
