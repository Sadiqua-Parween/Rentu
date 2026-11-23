"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookings_routes_1 = require("../bookings/bookings.routes");
const reminder_scheduler_1 = require("../notifications/reminder.scheduler");
const response_1 = require("../../middleware/response");
const env_1 = require("../../config/env");
const router = (0, express_1.Router)();
/**
 * Platform background cron tasks endpoint for Vercel Cron and automated runners.
 * Executes:
 * 1. Auto-cancellation of unverified expired bookings past pickup grace period.
 * 2. Automated dispatch of pickup/return reminders to borrowers and lenders.
 */
router.all('/tasks', async (req, res) => {
    const authHeader = req.headers.authorization;
    const vercelCronHeader = req.headers['x-vercel-cron'];
    const cronSecret = process.env.CRON_SECRET;
    const isVercelCron = vercelCronHeader === '1';
    const isAuthorizedSecret = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
    const isDev = env_1.ENV.NODE_ENV !== 'production';
    if (!isVercelCron && !isAuthorizedSecret && !isDev) {
        return (0, response_1.sendError)(res, 'UNAUTHORIZED', 'Unauthorized cron trigger', 401);
    }
    const startTime = Date.now();
    try {
        await (0, bookings_routes_1.checkAndAutoCancelExpiredBookings)(true);
        await (0, reminder_scheduler_1.runGlobalReminderCycle)();
        return (0, response_1.sendSuccess)(res, {
            status: 'success',
            tasks: ['checkAndAutoCancelExpiredBookings', 'runGlobalReminderCycle'],
            duration_ms: Date.now() - startTime,
            timestamp: new Date().toISOString(),
        }, 'Cron maintenance tasks executed successfully');
    }
    catch (err) {
        console.error('Cron execution error:', err);
        return (0, response_1.sendError)(res, 'CRON_EXECUTION_FAILED', err.message || 'Execution failed', 500);
    }
});
exports.default = router;
