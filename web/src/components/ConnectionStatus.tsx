'use client';

import { useSSE } from '@/hooks/useSSE';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

interface ConnectionStatusProps {
  showLastUpdated?: boolean;
  compact?: boolean;
  onRefresh?: () => void;
}

export function ConnectionStatus({ showLastUpdated = true, compact = false, onRefresh }: ConnectionStatusProps) {
  const { isConnected, lastUpdated, reconnectAttempt, error } = useSSE();

  const formatLastUpdated = (timestamp: number | null): string => {
    if (!timestamp) return 'Never';
    
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 5) return 'Just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    return `${Math.floor(seconds / 3600)}h ago`;
  };

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        {isConnected ? (
          <Wifi className="w-3.5 h-3.5 text-green-500" />
        ) : (
          <WifiOff className="w-3.5 h-3.5 text-red-500" />
        )}
        {!isConnected && reconnectAttempt > 0 && (
          <span className="text-xs text-muted-foreground">
            Reconnecting ({reconnectAttempt})...
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {isConnected ? (
        <>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <Wifi className="w-4 h-4 text-green-500" />
            <span className="text-green-600 font-medium">Live</span>
          </div>
          {showLastUpdated && (
            <span className="text-muted-foreground">
              Updated {formatLastUpdated(lastUpdated)}
            </span>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2">
          {reconnectAttempt > 0 ? (
            <div className="flex items-center gap-1.5 text-amber-600">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Reconnecting ({reconnectAttempt})...</span>
            </div>
          ) : error ? (
            <div className="flex items-center gap-1.5 text-red-600">
              <WifiOff className="w-4 h-4" />
              <span>{error}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <WifiOff className="w-4 h-4" />
              <span>Disconnected</span>
            </div>
          )}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="ml-2 text-blue-600 hover:text-blue-800 underline text-xs"
            >
              Refresh
            </button>
          )}
        </div>
      )}
    </div>
  );
}
