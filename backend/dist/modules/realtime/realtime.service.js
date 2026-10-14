"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeService = void 0;
class RealtimeService {
    static clients = new Map();
    static heartbeatInterval = null;
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
    static addClient(userId, res) {
        this.init();
        if (!this.clients.has(userId)) {
            this.clients.set(userId, new Set());
        }
        const userClients = this.clients.get(userId);
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
    static sendToUser(userId, event, data) {
        const userClients = this.clients.get(userId);
        if (!userClients || userClients.size === 0)
            return;
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        for (const res of userClients) {
            try {
                res.write(payload);
            }
            catch (err) {
                console.warn(`Failed to write to SSE client for user ${userId}:`, err);
                userClients.delete(res);
            }
        }
    }
    static broadcastPing() {
        for (const [userId, clientSet] of this.clients.entries()) {
            for (const res of clientSet) {
                try {
                    res.write(':ping\n\n');
                }
                catch {
                    clientSet.delete(res);
                }
            }
            if (clientSet.size === 0) {
                this.clients.delete(userId);
            }
        }
    }
    static getConnectedCount(userId) {
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
exports.RealtimeService = RealtimeService;
