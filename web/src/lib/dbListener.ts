/**
 * PostgreSQL LISTEN/NOTIFY listener for real-time SSE
 * 
 * Uses short listen pattern for serverless compatibility:
 * - Listen for LISTEN_DURATION_MS
 * - Send heartbeat to keep connection alive
 * - Reconnect and repeat
 */

import pg from 'pg';

export interface NotificationPayload {
  flight_key: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  predict_delay_minutes?: number | null;
  predicted_at?: string | null;
  status_group?: string;
  status_raw?: string;
  updated_at?: string;
  timestamp: number;
}

export interface ListenerCallbacks {
  onNotification: (payload: NotificationPayload) => void;
  onError: (error: Error) => void;
  onReconnecting: (attempt: number) => void;
  onConnected: () => void;
}

const LISTEN_CHANNELS = ['prediction_update', 'status_update'] as const;
const LISTEN_DURATION_MS = 25000; // 25 seconds (short listen for serverless)
const HEARTBEAT_INTERVAL_MS = 20000; // Send heartbeat every 20 seconds
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 1000;

export class DbListener {
  private connection: pg.Client | null = null;
  private callbacks: ListenerCallbacks;
  private isRunning = false;
  private reconnectAttempts = 0;
  private listenTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private currentChannel: string | null = null;

  constructor(callbacks: ListenerCallbacks) {
    this.callbacks = callbacks;
  }

  private async getConnection(): Promise<pg.Client> {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });
    await client.connect();
    return client;
  }

  private parsePayload(channel: string, payload: string): NotificationPayload {
    try {
      const data = JSON.parse(payload);
      return {
        ...data,
        timestamp: Date.now(),
      };
    } catch {
      // Fallback for simple text payload
      return {
        flight_key: payload || 'unknown',
        action: 'UPDATE',
        timestamp: Date.now(),
      };
    }
  }

  private async listenToChannel(channel: string): Promise<void> {
    if (!this.connection || !this.isRunning) return;

    try {
      this.currentChannel = channel;
      await this.connection.query(`LISTEN ${channel}`);
    } catch (error) {
      console.error(`Failed to LISTEN to ${channel}:`, error);
    }
  }

  private setupListeners(): void {
    if (!this.connection) return;

    this.connection.on('notification', (msg) => {
      if (msg.channel && msg.payload) {
        const payload = this.parsePayload(msg.channel, msg.payload);
        this.callbacks.onNotification(payload);
      }
    });

    this.connection.on('error', (err) => {
      console.error('PostgreSQL connection error:', err);
      this.callbacks.onError(err);
    });

    this.connection.on('end', () => {
      if (this.isRunning) {
        console.warn('Connection ended unexpectedly, reconnecting...');
        this.scheduleReconnect();
      }
    });
  }

  private async listenCycle(): Promise<void> {
    if (!this.isRunning || !this.connection) return;

    // Setup listeners for all channels
    this.setupListeners();

    // Listen to all channels
    for (const channel of LISTEN_CHANNELS) {
      await this.listenToChannel(channel);
    }

    this.callbacks.onConnected();
    this.reconnectAttempts = 0;

    // Start heartbeat interval
    this.heartbeatInterval = setInterval(() => {
      if (this.connection && !this.connection.ending) {
        // Send a simple query to keep connection alive
        this.connection.query('SELECT 1').catch(() => {
          // Ignore errors, connection might be dead
        });
      }
    }, HEARTBEAT_INTERVAL_MS);

    // Schedule end of listen cycle (for short listen pattern)
    this.listenTimeout = setTimeout(async () => {
      await this.endListenCycle();
    }, LISTEN_DURATION_MS);
  }

  private async endListenCycle(): Promise<void> {
    // Clear intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.listenTimeout) {
      clearTimeout(this.listenTimeout);
      this.listenTimeout = null;
    }

    // Close connection
    if (this.connection) {
      try {
        await this.connection.end();
      } catch {
        // Ignore errors during cleanup
      }
      this.connection = null;
    }

    // Schedule reconnect if still running
    if (this.isRunning) {
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (!this.isRunning) return;

    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
      this.callbacks.onError(new Error('Max reconnection attempts reached'));
      this.stop();
      return;
    }

    this.callbacks.onReconnecting(this.reconnectAttempts);

    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1),
      30000 // Max 30 seconds
    );

    setTimeout(() => {
      this.startCycle();
    }, delay);
  }

  private async startCycle(): Promise<void> {
    if (!this.isRunning) return;

    try {
      this.connection = await this.getConnection();
      await this.listenCycle();
    } catch (error) {
      console.error('Failed to start listen cycle:', error);
      this.callbacks.onError(error as Error);
      this.scheduleReconnect();
    }
  }

  /**
   * Start listening for notifications
   * Uses short listen pattern: listen for 25s, reconnect, repeat
   */
  start(): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.startCycle();
  }

  /**
   * Stop listening
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.listenTimeout) {
      clearTimeout(this.listenTimeout);
      this.listenTimeout = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.connection) {
      try {
        await this.connection.end();
      } catch {
        // Ignore errors during cleanup
      }
      this.connection = null;
    }
  }

  /**
   * Check if listener is running
   */
  get running(): boolean {
    return this.isRunning;
  }
}

/**
 * Create a single-use listener for one listen cycle
 * Useful for SSR or one-time fetches
 */
export async function singleListen(
  callback: (payload: NotificationPayload) => void,
  durationMs: number = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
    });

    const timeout = setTimeout(async () => {
      try {
        await client.end();
        resolve();
      } catch {
        resolve();
      }
    }, durationMs);

    client.connect()
      .then(() => {
        for (const channel of LISTEN_CHANNELS) {
          client.query(`LISTEN ${channel}`);
        }

        client.on('notification', (msg) => {
          if (msg.channel && msg.payload) {
            const payload: NotificationPayload = {
              ...JSON.parse(msg.payload),
              timestamp: Date.now(),
            };
            callback(payload);
          }
        });

        client.on('error', (err) => {
          clearTimeout(timeout);
          client.end().finally(() => reject(err));
        });
      })
      .catch((err) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}
