import { Router, Request, Response } from 'express';
import { checkAndAutoCancelExpiredBookings } from '../bookings/bookings.routes';
import { runGlobalReminderCycle } from '../notifications/reminder.scheduler';
import { sendSuccess, sendError } from '../../middleware/response';
import { ENV } from '../../config/env';

const router = Router();

/**
 * Platform background cron tasks endpoint for Vercel Cron and automated runners.
 * Executes:
 * 1. Auto-cancellation of unverified expired bookings past pickup grace period.
 * 2. Automated dispatch of pickup/return reminders to borrowers and lenders.
 */
router.all('/tasks', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  const vercelCronHeader = req.headers['x-vercel-cron'];
  const cronSecret = process.env.CRON_SECRET;

  const isVercelCron = vercelCronHeader === '1';
  const isAuthorizedSecret = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
  const isDev = ENV.NODE_ENV !== 'production';

  if (!isVercelCron && !isAuthorizedSecret && !isDev) {
    return sendError(res, 'UNAUTHORIZED', 'Unauthorized cron trigger', 401);
  }

  const startTime = Date.now();
  try {
    await checkAndAutoCancelExpiredBookings(true);
    await runGlobalReminderCycle();

    return sendSuccess(
      res,
      {
        status: 'success',
        tasks: ['checkAndAutoCancelExpiredBookings', 'runGlobalReminderCycle'],
        duration_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      },
      'Cron maintenance tasks executed successfully'
    );
  } catch (err: any) {
    console.error('Cron execution error:', err);
    return sendError(res, 'CRON_EXECUTION_FAILED', err.message || 'Execution failed', 500);
  }
});

export default router;
