export type RealtimeEventHandler = (data: any) => void;
export type RealtimeConnectionStatus = 'disconnected' | 'connecting' | 'connected';

class RealtimeEventHub {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<RealtimeEventHandler>> = new Map();
  private currentToken: string | null = null;
  private reconnectTimer: any = null;
  private status: RealtimeConnectionStatus = 'disconnected';

  getStatus(): RealtimeConnectionStatus {
    return this.status;
  }

  private setStatus(newStatus: RealtimeConnectionStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.emit('status_change', newStatus);
    }
  }

  init(token: string | null) {
    if (!token) {
      this.disconnect();
      return;
    }

    if (this.currentToken === token && this.eventSource) {
      return;
    }

    this.currentToken = token;
    this.connect();
  }

  private connect() {
    if (!this.currentToken || typeof window === 'undefined') return;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.setStatus('connecting');

    const apiBase = import.meta.env.VITE_API_URL 
      ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api` 
      : '/api';

    const url = `${apiBase}/realtime/stream?token=${encodeURIComponent(this.currentToken)}`;

    try {
      this.eventSource = new EventSource(url);

      this.eventSource.onopen = () => {
        this.setStatus('connected');
      };

      this.eventSource.addEventListener('notification', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('notification', data);
        } catch (err) {
          console.warn('Failed to parse realtime notification payload:', err);
        }
      });

      this.eventSource.addEventListener('message', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
        } catch (err) {
          console.warn('Failed to parse realtime message payload:', err);
        }
      });

      this.eventSource.addEventListener('messages_read', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('messages_read', data);
        } catch (err) {
          console.warn('Failed to parse realtime messages_read payload:', err);
        }
      });

      this.eventSource.addEventListener('booking_update', (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('booking_update', data);
        } catch (err) {
          console.warn('Failed to parse realtime booking payload:', err);
        }
      });

      this.eventSource.onerror = () => {
        // EventSource attempts native reconnect; if readyState is CLOSED or CONNECTING, handle state
        if (this.eventSource?.readyState === EventSource.CLOSED) {
          this.setStatus('disconnected');
          this.scheduleReconnect();
        } else {
          this.setStatus('connecting');
        }
      };
    } catch (err) {
      console.warn('Failed to initialize Realtime EventSource:', err);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      if (this.currentToken) {
        this.connect();
      }
    }, 4000);
  }

  on(event: string, handler: RealtimeEventHandler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  off(event: string, handler: RealtimeEventHandler) {
    this.listeners.get(event)?.delete(handler);
  }

  private emit(event: string, data: any) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`Error in realtime handler for '${event}':`, err);
        }
      }
    }
  }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.currentToken = null;
    this.setStatus('disconnected');
  }
}

export const RealtimeClient = new RealtimeEventHub();
