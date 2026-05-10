import { useEffect, useRef } from 'react';
import { checkDatabaseConnection } from '@/lib/checkDbConnection';
import { useToast } from '@/components/ui/ToastProvider';

/**
 * Hook to check database connection on mount.
 * Shows a toast error if the connection fails.
 */
export function useDatabaseHealthCheck() {
  const { showError } = useToast();
  const hasChecked = useRef(false);

  useEffect(() => {
    if (hasChecked.current) return;
    hasChecked.current = true;

    checkDatabaseConnection().then(({ connected, error }) => {
      if (!connected && error) {
        showError(error);
      }
    });
  }, [showError]);
}
