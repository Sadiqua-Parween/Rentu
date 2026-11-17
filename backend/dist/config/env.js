"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ENV = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const dotenv_1 = __importDefault(require("dotenv"));
// Attempt to load .env from multiple potential working directories / locations
const possibleEnvPaths = [
    path_1.default.resolve(process.cwd(), '.env'),
    path_1.default.resolve(process.cwd(), 'backend/.env'),
    path_1.default.resolve(__dirname, '../../.env'),
    path_1.default.resolve(__dirname, '../../../.env'),
    path_1.default.resolve(__dirname, '../../../backend/.env'),
];
for (const envPath of possibleEnvPaths) {
    if (fs_1.default.existsSync(envPath)) {
        dotenv_1.default.config({ path: envPath });
    }
}
dotenv_1.default.config(); // fallback default
const rawGeminiKey = (process.env.GEMINI_API_KEY || '').trim().replace(/^["']|["']$/g, '');
const isPlaceholderKey = rawGeminiKey.includes('your_key_here') ||
    rawGeminiKey.includes('your_gemini_api_key_here') ||
    rawGeminiKey === '';
const isProd = (process.env.NODE_ENV || 'production') === 'production';
if (!process.env.DATABASE_URL) {
    console.warn('SECURITY NOTICE: DATABASE_URL environment variable is missing.');
}
// Generate ephemeral random fallback secret per runtime process if not provided, preventing token forgery
const fallbackSecret = crypto_1.default.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET && isProd) {
    console.warn('SECURITY WARNING: JWT_SECRET is not set in production environment variables. Using dynamic ephemeral key.');
}
exports.ENV = {
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
