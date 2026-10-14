import { Response } from 'express';

export class RealtimeService {
  private static clients: Map<string, Set<Response>> = new Map();
  private static heartbeatInterval: NodeJS.Timeout | null = null;

  static init() {
    if (!this.heartbeatInterval) {
      // Send comment ping every 25 seconds to keep connections open through proxies/ngrok
      this.heartbeatInterval = setInterval(() => {
        this.broadcastPing();
      }, 25000);
      if (this.heartbeatInterval.unref) {
        this.heartbeatInterval.unref();
      }
    }
  }

  static addClient(userId: string, res: Response) {
    this.init();

    if (!this.clients.has(userId)) {
      this.clients.set(userId, new Set());
    }

    const userClients = this.clients.get(userId)!;
    userClients.add(res);

    // Initial connection confirmation
    res.write(`event: connected\ndata: ${JSON.stringify({ userId, connectedAt: new Date().toISOString() })}\n\n`);

    res.on('close', () => {
      userClients.delete(res);
      if (userClients.size === 0) {
        this.clients.delete(userId);
      }
    });
  }

  static sendToUser(userId: string, event: string, data: any) {
    this.sendToUsers([userId], event, data);
  }

  static sendToUsers(userIds: (string | undefined | null)[], event: string, data: any) {
    const targets = userIds.filter((id): id is string => typeof id === 'string' && id.length > 0);
    if (targets.length === 0) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const writtenResponses = new Set<Response>();

    for (const uid of targets) {
      const userClients = this.clients.get(uid);
      if (!userClients) continue;

      for (const res of Array.from(userClients)) {
        if (writtenResponses.has(res)) continue;
        writtenResponses.add(res);

        try {
          res.write(payload);
        } catch (err) {
          console.warn(`Failed to write to SSE client for user ${uid}:`, err);
          userClients.delete(res);
        }
      }
    }
  }

  private static broadcastPing() {
    for (const [userId, clientSet] of this.clients.entries()) {
      for (const res of clientSet) {
        try {
          res.write(':ping\n\n');
        } catch {
          clientSet.delete(res);
        }
      }
      if (clientSet.size === 0) {
        this.clients.delete(userId);
      }
    }
  }

  static getConnectedCount(userId?: string): number {
    if (userId) {
      return this.clients.get(userId)?.size || 0;
    }
    let total = 0;
    for (const set of this.clients.values()) {
      total += set.size;
    }
    return total;
  }
}
