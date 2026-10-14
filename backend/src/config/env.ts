import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';

if (nodeEnv === 'production') {
  if (!process.env.DATABASE_URL) {
    throw new Error('FATAL: DATABASE_URL environment variable is required in production.');
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('FATAL: JWT_SECRET environment variable is required in production.');
  }
}

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5001,
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || 'dev-rentu-fallback-jwt-secret-do-not-use-in-prod',
  NODE_ENV: nodeEnv,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'rentu-732b7',
  SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY || 'BDJrNfooBDHVn9HE49Gq-omM8ml0zxaTNhbbqQC3viLcLy0Ug4qWg25yLHMiOeoGM9sYqSZ-bR6xadyWSo7J1Lo',
  VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY || 'RJVgTmQ1qhx1oCXZmh9OENXNyuVev2aX0zd-uUeWJEQ',
  VAPID_SUBJECT: process.env.VAPID_SUBJECT || 'mailto:notifications@rentu.internal',
  AI_API_KEY: process.env.AI_API_KEY || process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY || '',
  AI_PROVIDER: (process.env.AI_PROVIDER || (process.env.OPENAI_API_KEY ? 'openai' : 'gemini')).toLowerCase(),
  AI_MODEL: process.env.AI_MODEL || (process.env.OPENAI_API_KEY ? 'gpt-4o-mini' : 'gemini-1.5-flash'),
};

