import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { optionalAuthMiddleware, authMiddleware, AuthenticatedRequest } from '../../middleware/auth';
import { sendSuccess, sendError } from '../../middleware/response';
import { executeRentuAiChat, getAiConfigStatus } from './ai.engine';
import { findCheapestListings, checkListingAvailability, compareRentalPrices, getRelevantBookingStatus, getListingDetails } from './ai.tools';

const router = Router();

// In-memory rate limiter for AI queries (max 40 queries per minute per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-client';
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxRequests = 40;

  const current = rateLimitMap.get(ip);
  if (!current || now > current.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (current.count >= maxRequests) {
    return sendError(res, 'RATE_LIMIT_EXCEEDED', 'Too many assistant queries. Please wait a moment before sending another message.', 429);
  }

  current.count += 1;
  next();
};

const chatRequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string().min(1, 'Message cannot be empty').max(2000, 'Message exceeds 2000 characters limit'),
    })
  ).min(1, 'At least one message is required').max(30, 'Conversation history too long'),
  contextItemId: z.string().uuid().optional(),
});

/**
 * GET /api/ai/status
 * Check if generative AI model is configured & connected tools
 */
router.get('/status', (req: Request, res: Response) => {
  const status = getAiConfigStatus();
  return sendSuccess(res, status);
});

/**
 * GET /api/ai/suggestions
 * Returns contextual suggestion chips for the UI
 */
router.get('/suggestions', (req: Request, res: Response) => {
  const suggestions = [
    { label: '📷 Cheapest camera', prompt: 'Find the cheapest camera available to rent.' },
    { label: '💰 Cameras under ₹500', prompt: 'Which cameras can I rent for under ₹500 per day?' },
    { label: '📅 Canon 250D tomorrow', prompt: 'Is the Canon EOS 250D DSLR available tomorrow for 2 days?' },
    { label: '⚖️ Compare cameras', prompt: 'Compare the available cameras by price and features.' },
    { label: '⛺ Weekend camping tent', prompt: 'Find a camping tent for 3 days this weekend.' },
    { label: '📽️ Projector for movie night', prompt: 'What is the cheapest projector for a weekend movie night?' },
  ];
  return sendSuccess(res, suggestions);
});

/**
 * POST /api/ai/chat
 * Primary conversation endpoint for Rentu AI Assistant
 */
router.post('/chat', optionalAuthMiddleware, rateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = chatRequestSchema.parse(req.body);
    const userId = (req as AuthenticatedRequest).user?.id;

    const result = await executeRentuAiChat(
      validated.messages,
      validated.contextItemId,
      userId
    );

    return sendSuccess(res, result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return sendError(res, 'VALIDATION_ERROR', error.errors[0]?.message || 'Invalid input format', 400);
    }
    next(error);
  }
});

/**
 * POST /api/ai/tools/cheapest
 * Direct tool route to query cheapest listings
 */
router.post('/tools/cheapest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query: searchQuery, category, maxPricePerDay, durationDays } = req.body;
    const result = await findCheapestListings({
      query: searchQuery,
      category,
      maxPricePerDay: maxPricePerDay ? Number(maxPricePerDay) : undefined,
      durationDays: durationDays ? Number(durationDays) : 1,
    });
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/tools/availability
 * Direct tool route to check date availability
 */
router.post('/tools/availability', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId, startDate, durationDays, endDate } = req.body;
    if (!itemId) {
      return sendError(res, 'VALIDATION_ERROR', 'itemId is required', 400);
    }
    const result = await checkListingAvailability({
      itemId,
      startDate,
      durationDays: durationDays ? Number(durationDays) : undefined,
      endDate,
    });
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/tools/compare
 * Direct tool route to compare multiple items
 */
router.post('/tools/compare', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemIds, searchQuery, durationDays } = req.body;
    const result = await compareRentalPrices({
      itemIds,
      searchQuery,
      durationDays: durationDays ? Number(durationDays) : 1,
    });
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/tools/booking-status
 * Strictly authenticated tool route to check private booking status
 */
router.post('/tools/booking-status', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { bookingId } = req.body;
    if (!bookingId) {
      return sendError(res, 'VALIDATION_ERROR', 'bookingId is required', 400);
    }
    const userId = (req as AuthenticatedRequest).user?.id || '';
    const result = await getRelevantBookingStatus(bookingId, userId);
    if (!result.authorized) {
      return sendError(res, 'FORBIDDEN', result.error || 'Access denied', 403);
    }
    return sendSuccess(res, result.booking);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/ai/tools/details
 * Fetch authoritative listing details directly from database
 */
router.post('/tools/details', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId, durationDays } = req.body;
    if (!itemId) {
      return sendError(res, 'VALIDATION_ERROR', 'itemId is required', 400);
    }
    const result = await getListingDetails(itemId, durationDays ? Number(durationDays) : 1);
    if (!result) {
      return sendError(res, 'NOT_FOUND', 'Listing not found in database', 404);
    }
    return sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
