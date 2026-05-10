/**
 * Check database connection status
 * Returns true if connection is successful, false otherwise
 */
export async function checkDatabaseConnection(): Promise<{ connected: boolean; error?: string }> {
  try {
    const response = await fetch('/api/health/db');

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        connected: false,
        error: data.message || `HTTP ${response.status}: Không thể kết nối database`,
      };
    }

    const data = await response.json();

    if (data.status === 'ok') {
      return { connected: true };
    }

    return {
      connected: false,
      error: data.message || 'Phản hồi không hợp lệ từ server',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định';
    return {
      connected: false,
      error: `Không thể kết nối database: ${message}`,
    };
  }
}
