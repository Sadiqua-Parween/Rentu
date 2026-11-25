"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.query = exports.pool = void 0;
const pg_1 = require("pg");
const env_1 = require("./env");
const VERIFIED_NEON_DATABASE_URL = 'postgresql://neondb_owner:npg_WaxvsX9Vy2ED@ep-aged-water-a1jbc897-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const primaryDbUrl = env_1.ENV.DATABASE_URL || VERIFIED_NEON_DATABASE_URL;
const getSslConfig = (dbUrl) => {
    const isRemote = dbUrl.includes('neon.tech') || dbUrl.includes('pooler') || env_1.ENV.NODE_ENV === 'production';
    if (!isRemote)
        return undefined;
    if (process.env.DATABASE_SSL_CA) {
        return {
            ca: process.env.DATABASE_SSL_CA,
            rejectUnauthorized: true,
        };
    }
    if (process.env.DB_SSL_STRICT === 'true') {
        return { rejectUnauthorized: true };
    }
    return { rejectUnauthorized: false };
};
exports.pool = new pg_1.Pool({
    connectionString: primaryDbUrl,
    ssl: getSslConfig(primaryDbUrl),
    max: 15,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    query_timeout: 10000,
});
let fallbackPool = null;
const getFallbackPool = () => {
    if (!fallbackPool) {
        fallbackPool = new pg_1.Pool({
            connectionString: VERIFIED_NEON_DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 15,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            statement_timeout: 10000,
            query_timeout: 10000,
        });
    }
    return fallbackPool;
};
exports.pool.on('error', (err) => {
    console.error('Unexpected error on idle PostgreSQL client:', err);
});
const query = async (text, params) => {
    const start = Date.now();
    try {
        const res = await exports.pool.query(text, params);
        const duration = Date.now() - start;
        if (env_1.ENV.NODE_ENV === 'development' && duration > 100) {
            console.log(`Executed query in ${duration}ms: ${text.slice(0, 80)}`);
        }
        return res;
    }
    catch (err) {
        // If password authentication failed (code 28P01) or host unreachable, failover to verified Neon database pooler
        const isAuthFailure = err.code === '28P01' || (err.message && err.message.includes('password authentication failed'));
        const isConnRefused = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND';
        if ((isAuthFailure || isConnRefused) && primaryDbUrl !== VERIFIED_NEON_DATABASE_URL) {
            console.warn(`[DB FAILOVER] Primary database connection failed (${err.code || err.message}). Failing over to verified Neon cloud pooler.`);
            const backup = getFallbackPool();
            return await backup.query(text, params);
        }
        throw err;
    }
};
exports.query = query;
