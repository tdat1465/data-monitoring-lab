/**
 * SSE Endpoint for real-time flight updates
 * 
 * Uses short listen pattern for serverless compatibility:
 * - Creates a new DbListener for each SSE connection
 * - Listener runs for LISTEN_DURATION_MS (25s) then reconnects
 * - Sends heartbeat every HEARTBEAT_INTERVAL_MS
 * - Client should auto-reconnect to maintain real-time updates
 */

import { DbListener, NotificationPayload } from '@/lib/dbListener';
import { query } from '@/lib/db';

// How long to listen before reconnecting (in milliseconds)
const LISTEN_DURATION_MS = 25000;
// How often to send heartbeat (in milliseconds)
const HEARTBEAT_INTERVAL_MS = 20000;
// How long to wait for initial connection (in milliseconds)
const INITIAL_CONNECTION_TIMEOUT_MS = 5000;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function createSSEStream(listenDurationMs: number = LISTEN_DURATION_MS): ReadableStream {
  let dbListener: DbListener | null = null;
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  let cleanupFn: (() => void) | null = null;

  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      let isConnected = false;

      // Send initial connection event
      controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`));

      // Set up heartbeat
      heartbeatInterval = setInterval(() => {
        if (isConnected) {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        }
      }, HEARTBEAT_INTERVAL_MS);

      // Create listener
      dbListener = new DbListener({
        onNotification: (payload: NotificationPayload) => {
          isConnected = true;
          const sseData = JSON.stringify({
            type: payload.action === 'UPDATE' && 'predict_delay_minutes' in payload 
              ? 'prediction_update' 
              : 'status_update',
            payload,
          });
          controller.enqueue(encoder.encode(`event: notification\ndata: ${sseData}\n\n`));
        },
        onError: (error: Error) => {
          console.error('SSE Listener error:', error);
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`));
        },
        onReconnecting: (attempt: number) => {
          console.log(`SSE Reconnecting, attempt ${attempt}`);
          controller.enqueue(encoder.encode(`event: reconnecting\ndata: ${JSON.stringify({ attempt })}\n\n`));
        },
        onConnected: () => {
          isConnected = true;
          controller.enqueue(encoder.encode(`event: connected\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`));
        },
      });

      // Start listening
      dbListener.start();

      // Set up cleanup function
      cleanupFn = () => {
        if (dbListener) {
          dbListener.stop();
          dbListener = null;
        }
        if (heartbeatInterval) {
          clearInterval(heartbeatInterval);
          heartbeatInterval = null;
        }
      };

      // Auto-reconnect after listen duration
      setTimeout(() => {
        if (cleanupFn) {
          cleanupFn();
          cleanupFn = null;
        }
        // Signal client to reconnect
        controller.enqueue(encoder.encode(`event: reconnect\ndata: ${JSON.stringify({ timestamp: Date.now() })}\n\n`));
        controller.close();
      }, listenDurationMs);
    },
    cancel() {
      // Cleanup when stream is cancelled (client disconnects)
      if (cleanupFn) {
        cleanupFn();
        cleanupFn = null;
      }
    },
  });
}

export async function GET(request: Request) {
  // Check if client wants to receive current data on connect
  const url = new URL(request.url);
  const includeInitialData = url.searchParams.get('includeInitial') !== 'false';

  const stream = createSSEStream();

  const response = new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });

  // Set timeout for the response
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, LISTEN_DURATION_MS * 10); // Max 10 listen cycles (about 4 minutes)

  // Clean up on abort
  response.body?.cancel().catch(() => {});

  return response;
}
