import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';

// Attempt to load .env from multiple potential working directories / locations
const possibleEnvPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), 'backend/.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
  path.resolve(__dirname, '../../../backend/.env'),
];

for (const envPath of possibleEnvPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
}
dotenv.config(); // fallback default

const rawGeminiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const isPlaceholderKey =
  rawGeminiKey.includes('your_key_here') ||
  rawGeminiKey.includes('your_gemini_api_key_here') ||
  rawGeminiKey === '';

const isProd = (process.env.NODE_ENV || 'production') === 'production' || Boolean(process.env.VERCEL);

// In production, ensure sensitive environment variables are strictly defined in environment variables (e.g. Vercel dashboard)
if (isProd && !process.env.DATABASE_URL) {
  console.error('FATAL SECURITY NOTICE: DATABASE_URL environment variable is missing.');
}

// Generate ephemeral random fallback secret per runtime process in development if not provided, preventing token forgery
const fallbackSecret = crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET && isProd) {
  console.warn('SECURITY WARNING: JWT_SECRET is not set in production environment variables. Using dynamic ephemeral key.');
}

export const ENV = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 5001,
  DATABASE_URL: process.env.DATABASE_URL || '',
  JWT_SECRET: process.env.JWT_SECRET || fallbackSecret,
  NODE_ENV: process.env.NODE_ENV || (process.env.VERCEL ? 'production' : 'development'),
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID || 'rentu-732b7',
  GEMINI_API_KEY: isPlaceholderKey ? '' : rawGeminiKey,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || '',
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '',
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || '',
};
