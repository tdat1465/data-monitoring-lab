/**
 * Component to check database connection status.
 * Shows an error toast if connection fails.
 * Renders nothing when connection succeeds.
 */
'use client';

import { useDatabaseHealthCheck } from '@/hooks/useDatabaseHealthCheck';

export function DatabaseHealthChecker() {
  useDatabaseHealthCheck();
  return null;
}
