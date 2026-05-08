'use client';

import { useEffect, useRef, useCallback, useState } from 'react';

export interface SSENotification {
  type: 'prediction_update' | 'status_update';
  payload: {
    flight_key: string;
    action: 'INSERT' | 'UPDATE' | 'DELETE';
    predict_delay_minutes?: number | null;
    predicted_at?: string | null;
    status_group?: string;
    status_raw?: string;
    updated_at?: string;
    timestamp: number;
  };
}

export interface SSEState {
  isConnected: boolean;
  lastUpdated: number | null;
  notifications: SSENotification[];
  reconnectAttempt: number;
  error: string | null;
}

const SSE_RECONNECT_DELAY_MS = 1000;
const SSE_MAX_RECONNECT_ATTEMPTS = 10;
const SSE_BUFFER_SIZE = 50; // Keep last 50 notifications

interface UseSSEOptions {
  /** URL to connect to (defaults to /api/stream) */
  url?: string;
  /** Callback when notification received */
  onNotification?: (notification: SSENotification) => void;
  /** Callback when connection status changes */
  onConnectionChange?: (isConnected: boolean) => void;
  /** Enable debug logging */
  debug?: boolean;
}

export function useSSE(options: UseSSEOptions = {}) {
  const {
    url = '/api/stream',
    onNotification,
    onConnectionChange,
    debug = false,
  } = options;

  const [state, setState] = useState<SSEState>({
    isConnected: false,
    lastUpdated: null,
    notifications: [],
    reconnectAttempt: 0,
    error: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const isMountedRef = useRef(true);

  const log = useCallback((...args: unknown[]) => {
    if (debug) {
      console.log('[useSSE]', ...args);
    }
  }, [debug]);

  const updateState = useCallback((updates: Partial<SSEState>) => {
    if (isMountedRef.current) {
      setState(prev => ({ ...prev, ...updates }));
    }
  }, []);

  const connect = useCallback(() => {
    if (!isMountedRef.current) return;

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    log('Connecting to SSE endpoint:', url);
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', () => {
      log('Connected to SSE');
      reconnectAttemptRef.current = 0;
      updateState({
        isConnected: true,
        reconnectAttempt: 0,
        error: null,
      });
      onConnectionChange?.(true);
    });

    eventSource.addEventListener('notification', (event) => {
      try {
        const data = JSON.parse(event.data);
        const notification: SSENotification = {
          type: data.type,
          payload: data.payload,
        };

        log('Received notification:', notification);

        setState(prev => {
          const notifications = [notification, ...prev.notifications].slice(0, SSE_BUFFER_SIZE);
          return {
            ...prev,
            lastUpdated: Date.now(),
            notifications,
          };
        });

        onNotification?.(notification);
      } catch (error) {
        log('Error parsing notification:', error);
      }
    });

    eventSource.addEventListener('heartbeat', () => {
      log('Heartbeat received');
    });

    eventSource.addEventListener('reconnecting', (event) => {
      const data = JSON.parse(event.data);
      log('Reconnecting, attempt:', data.attempt);
      updateState({ reconnectAttempt: data.attempt });
    });

    eventSource.addEventListener('reconnect', () => {
      log('Reconnect signal received');
      // EventSource will auto-reconnect, but we schedule a manual reconnect as backup
      scheduleReconnect(0);
    });

    eventSource.addEventListener('error', (event) => {
      log('SSE error:', event);
      updateState({ isConnected: false });
      onConnectionChange?.(false);
    });

    eventSource.onerror = () => {
      log('SSE onerror triggered');
      eventSource.close();
      updateState({ isConnected: false });
      onConnectionChange?.(false);
      scheduleReconnect();
    };
  }, [url, log, updateState, onNotification, onConnectionChange]);

  const scheduleReconnect = useCallback((delay?: number) => {
    if (!isMountedRef.current) return;

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const attempt = reconnectAttemptRef.current;

    if (attempt >= SSE_MAX_RECONNECT_ATTEMPTS) {
      log('Max reconnection attempts reached');
      updateState({
        error: 'Connection lost. Please refresh the page.',
        reconnectAttempt: attempt,
      });
      return;
    }

    const reconnectDelay = delay ?? Math.min(
      SSE_RECONNECT_DELAY_MS * Math.pow(2, attempt),
      30000 // Max 30 seconds
    );

    log(`Scheduling reconnect in ${reconnectDelay}ms (attempt ${attempt + 1})`);

    reconnectAttemptRef.current = attempt + 1;
    updateState({ reconnectAttempt: attempt + 1 });

    reconnectTimeoutRef.current = setTimeout(() => {
      connect();
    }, reconnectDelay);
  }, [connect, log, updateState]);

  const disconnect = useCallback(() => {
    log('Disconnecting SSE');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    updateState({
      isConnected: false,
      reconnectAttempt: 0,
    });
    onConnectionChange?.(false);
  }, [log, updateState, onConnectionChange]);

  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [] }));
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    connect();

    return () => {
      isMountedRef.current = false;
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...state,
    connect,
    disconnect,
    clearNotifications,
  };
}

/**
 * Hook for subscribing to specific flight updates
 */
export function useFlightUpdates(flightKey: string, options: UseSSEOptions = {}) {
  const { onNotification, debug = false } = options;

  const [lastUpdate, setLastUpdate] = useState<SSENotification['payload'] | null>(null);

  const handleNotification = useCallback((notification: SSENotification) => {
    if (notification.payload.flight_key === flightKey) {
      setLastUpdate(notification.payload);
      onNotification?.(notification);
    }
  }, [flightKey, onNotification]);

  const sse = useSSE({
    ...options,
    onNotification: handleNotification,
    debug,
  });

  return {
    ...sse,
    lastUpdate,
  };
}

/**
 * Hook for real-time flight list updates
 * Automatically refreshes data when notification received
 */
export function useRealtimeFlights(flightKeys: string[], options: UseSSEOptions = {}) {
  const { onNotification, debug = false } = options;

  const [updatedKeys, setUpdatedKeys] = useState<Set<string>>(new Set());
  const updatedKeysRef = useRef<Set<string>>(new Set());

  const handleNotification = useCallback((notification: SSENotification) => {
    const key = notification.payload.flight_key;
    
    if (flightKeys.includes(key)) {
      updatedKeysRef.current = new Set([...updatedKeysRef.current, key]);
      setUpdatedKeys(new Set(updatedKeysRef.current));
      onNotification?.(notification);
    }
  }, [flightKeys, onNotification]);

  const sse = useSSE({
    ...options,
    onNotification: handleNotification,
    debug,
  });

  const clearUpdatedKeys = useCallback(() => {
    updatedKeysRef.current = new Set();
    setUpdatedKeys(new Set());
  }, []);

  return {
    ...sse,
    updatedKeys: Array.from(updatedKeys),
    clearUpdatedKeys,
  };
}
