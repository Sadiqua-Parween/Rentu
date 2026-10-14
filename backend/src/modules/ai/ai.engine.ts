import { ENV } from '../../config/env';
import {
  searchListings,
  findCheapestListings,
  compareRentalPrices,
  checkListingAvailability,
  getRelevantBookingStatus,
  getListingDetails,
  ListingResult,
} from './ai.tools';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiChatResponse {
  message: string;
  listings?: ListingResult[];
  comparison?: any;
  availability?: any;
  toolsUsed?: string[];
  isGenerative: boolean;
  setupNotice?: string;
}

export function isAiConfigured(): boolean {
  return Boolean(ENV.AI_API_KEY && ENV.AI_API_KEY.trim().length > 5);
}

export function getAiConfigStatus() {
  const configured = isAiConfigured();
  return {
    configured,
    provider: configured ? ENV.AI_PROVIDER : 'database_direct',
    model: configured ? ENV.AI_MODEL : 'rentu-deterministic-engine',
    instructions: configured
      ? 'AI provider is active and connected to PostgreSQL database tools.'
      : 'To activate full generative AI responses, add AI_API_KEY to backend/.env (Free Google Gemini key: https://aistudio.google.com/).',
  };
}

const SYSTEM_PROMPT = `
You are Rentu AI, the official rental intelligence assistant for Rentu — India's verified peer-to-peer equipment sharing marketplace.
Your goal is to help users find rental gear (cameras, projectors, camping gear, gaming consoles, tools, audio, fits), find the cheapest prices, check real dates availability, and compare listings.

CORE DIRECTIVES:
1. NEVER invent, hallucinate, or fabricate listings, prices, user ratings, or availability.
2. ALWAYS call the provided tools to inspect actual database records before making any claims.
3. Currency is Indian Rupees (₹). Clearly specify daily rates (e.g. ₹350/day) and total rental costs for the requested duration.
4. Distinguish rental costs from purchase prices. Only compare to purchase costs when meaningful data exists.
5. If no items match the user's budget or category, state that honestly and suggest adjusting the dates, budget, or category.
6. When availability is checked, inform the user if the item is available or already reserved for an accepted booking.
7. Keep responses concise, warm, helpful, and community-oriented.
`.trim();

/**
 * Intelligent Deterministic Dispatcher for Direct Database Execution
 * (Guarantees zero-hallucination functionality even when external AI API key is not yet configured)
 */
async function processDirectDatabaseIntent(
  userQuery: string,
  contextItemId?: string,
  currentUserId?: string
): Promise<AiChatResponse> {
  const lower = userQuery.toLowerCase();
  const toolsUsed: string[] = [];

  // 1. Availability checking intent ("available", "booked", "can i rent tomorrow", "dates")
  if (
    lower.includes('available') || 
    lower.includes('booked') || 
    lower.includes('tomorrow') || 
    lower.includes('weekend') ||
    lower.includes('can i rent') ||
    lower.includes('availability')
  ) {
    toolsUsed.push('checkListingAvailability');
    let targetItemId = contextItemId;

    // If no context item ID, extract product keyword and search database
    if (!targetItemId) {
      const cleanKeyword = userQuery
        .replace(/\b(?:is|the|available|tomorrow|next|weekend|booked|can|i|rent|for|\d+\s*days?|this|a|an|check|status|of|on)\b/gi, ' ')
        .replace(/[?.,!]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (cleanKeyword.length >= 2) {
        const searchRes = await searchListings({ query: cleanKeyword, limit: 1 });
        if (searchRes.items.length > 0) {
          targetItemId = searchRes.items[0].id;
        }
      }
    }

    if (!targetItemId) {
      // Find all available items for general query
      const cameras = await searchListings({ query: 'camera', limit: 3 });
      return {
        message: 'Which specific gear would you like to check dates for? Here are some top available items you can select:',
        listings: cameras.items,
        toolsUsed,
        isGenerative: false,
        setupNotice: '⚡ Running in database-direct mode. Add AI_API_KEY to backend/.env for conversational chat.',
      };
    }

    // Determine target start date (explicit YYYY-MM-DD, tomorrow, or weekend)
    let startDateStr: string;
    const explicitDateMatch = userQuery.match(/\b(\d{4}-\d{2}-\d{2})\b/);
    if (explicitDateMatch) {
      startDateStr = explicitDateMatch[1];
    } else {
      const targetDate = new Date();
      if (lower.includes('tomorrow')) {
        targetDate.setDate(targetDate.getDate() + 1);
      } else if (lower.includes('weekend')) {
        // Next Friday/Saturday
        const day = targetDate.getDay();
        const diff = (5 - day + 7) % 7 || 7;
        targetDate.setDate(targetDate.getDate() + diff);
      } else {
        targetDate.setDate(targetDate.getDate() + 1);
      }
      startDateStr = targetDate.toISOString().split('T')[0];
    }

    const durationDays = lower.includes('3 day') ? 3 : lower.includes('2 day') ? 2 : lower.includes('weekend') ? 3 : 2;

    const avail = await checkListingAvailability({
      itemId: targetItemId,
      startDate: startDateStr,
      durationDays,
    });

    return {
      message: avail.reason + (avail.pricingBreakdown ? ` Total cost is ₹${avail.pricingBreakdown.totalRent} with zero security deposit on verified ID.` : ''),
      listings: avail.item ? [avail.item] : [],
      availability: avail,
      toolsUsed,
      isGenerative: false,
      setupNotice: '⚡ Running in database-direct mode. Add AI_API_KEY to backend/.env for conversational chat.',
    };
  }

  // 2. Comparison intent ("compare", "difference", "vs", "which is better")
  if (lower.includes('compare') || lower.includes(' vs ') || lower.includes('versus') || lower.includes('difference')) {
    toolsUsed.push('compareRentalPrices');
    let queryTerm = 'camera';
    if (lower.includes('projector')) queryTerm = 'projector';
    else if (lower.includes('tent')) queryTerm = 'tent';
    else if (lower.includes('playstation') || lower.includes('ps5') || lower.includes('gaming')) queryTerm = 'playstation';

    const duration = lower.includes('3 day') ? 3 : lower.includes('2 day') ? 2 : 1;
    const compRes = await compareRentalPrices({
      searchQuery: queryTerm,
      durationDays: duration,
      limit: 4,
    });

    const items = compRes.comparison.items;
    let message = '';
    if (items.length >= 2) {
      message = `Here is a side-by-side comparison for ${duration} ${duration === 1 ? 'day' : 'days'}. The lowest rate is "${items[0].title}" at ₹${items[0].price_per_day}/day (₹${items[0].total_price} total), saving ₹${items[0].dailySavingsVsHighest}/day compared to the top option.`;
    } else if (items.length === 1) {
      message = `Found 1 verified listing for ${queryTerm}: "${items[0].title}" at ₹${items[0].price_per_day}/day.`;
    } else {
      message = `No items found in the database to compare for "${queryTerm}".`;
    }

    return {
      message,
      listings: items,
      comparison: compRes.comparison,
      toolsUsed,
      isGenerative: false,
      setupNotice: '⚡ Running in database-direct mode. Add AI_API_KEY to backend/.env for conversational chat.',
    };
  }

  // 3. Cheapest price finder intent ("cheapest", "lowest", "under", "less than", "budget")
  if (lower.includes('cheap') || lower.includes('under') || lower.includes('less than') || lower.includes('budget') || lower.includes('affordable')) {
    toolsUsed.push('findCheapestListings');

    // Extract budget limit if present (e.g. "under 500", "less than ₹400")
    let maxPrice: number | undefined;
    const priceMatch = lower.match(/(?:under|less than|below|budget of)\s*(?:₹|rs\.?|inr)?\s*(\d+)/i);
    if (priceMatch) {
      maxPrice = parseInt(priceMatch[1], 10);
    }

    // Extract search keyword
    let term = '';
    if (lower.includes('camera') || lower.includes('dslr')) term = 'camera';
    else if (lower.includes('projector')) term = 'projector';
    else if (lower.includes('tent')) term = 'tent';
    else if (lower.includes('headphone') || lower.includes('audio')) term = 'headphone';
    else if (lower.includes('guitar')) term = 'guitar';
    else if (lower.includes('drill') || lower.includes('tool')) term = 'drill';
    else if (lower.includes('game') || lower.includes('ps5')) term = 'playstation';

    // Extract duration
    let duration = 1;
    const durMatch = lower.match(/(\d+)\s*days?/i);
    if (durMatch) {
      duration = parseInt(durMatch[1], 10);
    } else if (lower.includes('three days') || lower.includes('3 days')) {
      duration = 3;
    } else if (lower.includes('two days') || lower.includes('2 days')) {
      duration = 2;
    } else if (lower.includes('weekend')) {
      duration = 3;
    }

    const cheapestRes = await findCheapestListings({
      query: term || undefined,
      maxPricePerDay: maxPrice,
      durationDays: duration,
      limit: 6,
    });

    return {
      message: cheapestRes.explanation,
      listings: cheapestRes.items,
      toolsUsed,
      isGenerative: false,
      setupNotice: '⚡ Running in database-direct mode. Add AI_API_KEY to backend/.env for conversational chat.',
    };
  }

  // 4. Default Search / Browse Intent
  toolsUsed.push('searchListings');
  let cleanTerm = userQuery
    .replace(/^(show me|find|search for|look for|do you have|where can i rent)\s+/i, '')
    .trim();

  const searchRes = await searchListings({
    query: cleanTerm.length > 2 ? cleanTerm : undefined,
    limit: 6,
  });

  const msg = searchRes.items.length > 0
    ? `I searched Rentu's verified community listings for "${cleanTerm || 'gear'}". Found ${searchRes.items.length} available items:`
    : `I searched for "${cleanTerm}" but couldn't find any active listings in your area right now. Try searching for cameras, tents, projectors, or drills!`;

  return {
    message: msg,
    listings: searchRes.items,
    toolsUsed,
    isGenerative: false,
    setupNotice: '⚡ Running in database-direct mode. Add AI_API_KEY to backend/.env for conversational chat.',
  };
}

/**
 * Generative AI Integration via Google Gemini API
 */
async function callGeminiApi(
  messages: ChatMessage[],
  contextItemId?: string,
  currentUserId?: string
): Promise<AiChatResponse> {
  const apiKey = ENV.AI_API_KEY;
  const model = ENV.AI_MODEL.includes('gemini') ? ENV.AI_MODEL : 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Tools declaration for Gemini
  const toolsDeclaration = [
    {
      functionDeclarations: [
        {
          name: 'searchListings',
          description: 'Search available rental equipment listings in Rentu database by keyword, category, max price, or location.',
          parameters: {
            type: 'OBJECT',
            properties: {
              query: { type: 'STRING', description: 'Search term e.g. camera, tent, projector' },
              category: { type: 'STRING', description: 'Category e.g. Electronics & Tech, Camping & Outdoor' },
              maxPricePerDay: { type: 'NUMBER', description: 'Max daily rental budget in INR' },
              durationDays: { type: 'INTEGER', description: 'Desired rental duration in days' },
              locality: { type: 'STRING', description: 'Target city or neighborhood' },
            },
          },
        },
        {
          name: 'findCheapestListings',
          description: 'Find lowest price rental gear sorted by total cost for requested duration.',
          parameters: {
            type: 'OBJECT',
            properties: {
              query: { type: 'STRING', description: 'Product term e.g. camera, projector' },
              maxPricePerDay: { type: 'NUMBER', description: 'Max price per day in INR' },
              durationDays: { type: 'INTEGER', description: 'Duration in days' },
            },
          },
        },
        {
          name: 'checkListingAvailability',
          description: 'Check actual calendar availability for an item and detect overlapping bookings.',
          parameters: {
            type: 'OBJECT',
            properties: {
              itemId: { type: 'STRING', description: 'Unique UUID of the listing to check' },
              startDate: { type: 'STRING', description: 'Requested start date in YYYY-MM-DD format' },
              durationDays: { type: 'INTEGER', description: 'Rental duration in days' },
            },
            required: ['itemId'],
          },
        },
        {
          name: 'compareRentalPrices',
          description: 'Compare 2-4 listings by daily rate, total rent for duration, and features.',
          parameters: {
            type: 'OBJECT',
            properties: {
              searchQuery: { type: 'STRING', description: 'Category or product term to compare e.g. camera' },
              durationDays: { type: 'INTEGER', description: 'Rental duration in days' },
            },
          },
        },
        {
          name: 'getListingDetails',
          description: 'Fetch complete verified details, pricing breakdown, and owner trust info for a specific listing ID.',
          parameters: {
            type: 'OBJECT',
            properties: {
              itemId: { type: 'STRING', description: 'Listing UUID' },
              durationDays: { type: 'INTEGER', description: 'Rental duration in days' },
            },
            required: ['itemId'],
          },
        },
      ],
    },
  ];

  // Prepare Gemini contents
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  // Append context item hint if present
  if (contextItemId && contents.length > 0) {
    contents[contents.length - 1].parts.push({
      text: `[User is currently viewing listing ID: ${contextItemId}. Prioritize this item for questions about this gear.]`,
    });
  }

  const payload = {
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    tools: toolsDeclaration,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 800,
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error('Gemini API Error:', response.status, errText);
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let functionCall = parts.find((p: any) => p.functionCall)?.functionCall;
  const toolsUsed: string[] = [];
  let attachedListings: ListingResult[] = [];
  let comparisonData: any = null;
  let availabilityData: any = null;

  // If Gemini decided to call a database tool, execute it
  if (functionCall) {
    toolsUsed.push(functionCall.name);
    const args = functionCall.args || {};

    let toolResultText = '';
    if (functionCall.name === 'searchListings') {
      const res = await searchListings(args);
      attachedListings = res.items;
      toolResultText = JSON.stringify(res);
    } else if (functionCall.name === 'findCheapestListings') {
      const res = await findCheapestListings(args);
      attachedListings = res.items;
      toolResultText = JSON.stringify(res);
    } else if (functionCall.name === 'checkListingAvailability') {
      const res = await checkListingAvailability({
        itemId: args.itemId || contextItemId || '',
        startDate: args.startDate,
        durationDays: args.durationDays,
      });
      if (res.item) attachedListings = [res.item];
      availabilityData = res;
      toolResultText = JSON.stringify(res);
    } else if (functionCall.name === 'compareRentalPrices') {
      const res = await compareRentalPrices(args);
      attachedListings = res.comparison.items;
      comparisonData = res.comparison;
      toolResultText = JSON.stringify(res);
    } else if (functionCall.name === 'getListingDetails') {
      const res = await getListingDetails(args.itemId || contextItemId || '', args.durationDays);
      if (res) attachedListings = [res];
      toolResultText = JSON.stringify(res);
    }

    // Second turn to summarize tool execution
    const followUpContents = [
      ...contents,
      {
        role: 'model',
        parts: [{ functionCall }],
      },
      {
        role: 'user',
        parts: [
          {
            functionResponse: {
              name: functionCall.name,
              response: { content: toolResultText },
            },
          },
        ],
      },
    ];

    const followUpRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: followUpContents,
        generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
      }),
    });

    if (followUpRes.ok) {
      const followUpData = await followUpRes.json();
      const followUpText = followUpData.candidates?.[0]?.content?.parts?.[0]?.text;
      if (followUpText) {
        return {
          message: followUpText,
          listings: attachedListings,
          comparison: comparisonData,
          availability: availabilityData,
          toolsUsed,
          isGenerative: true,
        };
      }
    }
  }

  // Text response
  const rawText = parts.find((p: any) => p.text)?.text || 'I checked our rental listings for you.';
  return {
    message: rawText,
    listings: attachedListings,
    comparison: comparisonData,
    availability: availabilityData,
    toolsUsed,
    isGenerative: true,
  };
}

/**
 * Main AI Engine Handler
 */
export async function executeRentuAiChat(
  messages: ChatMessage[],
  contextItemId?: string,
  currentUserId?: string
): Promise<AiChatResponse> {
  const lastUserMsg = messages[messages.length - 1]?.content || '';

  // 1. If real AI key is configured, use real Generative AI model with database tools
  if (isAiConfigured()) {
    try {
      return await callGeminiApi(messages, contextItemId, currentUserId);
    } catch (err: any) {
      console.warn('AI provider call failed, falling back to deterministic database tools:', err.message);
      // Fallback cleanly to database tools
      const fallback = await processDirectDatabaseIntent(lastUserMsg, contextItemId, currentUserId);
      return {
        ...fallback,
        setupNotice: `Notice: AI provider API returned an error (${err.message}). Ground-truth database tools were used instead.`,
      };
    }
  }

  // 2. Direct database execution with deterministic tools when no external key is configured
  return await processDirectDatabaseIntent(lastUserMsg, contextItemId, currentUserId);
}
