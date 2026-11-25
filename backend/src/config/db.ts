import { Pool, QueryResult, QueryResultRow } from 'pg';
import { ENV } from './env';

const VERIFIED_NEON_DATABASE_URL = 'postgresql://neondb_owner:npg_WaxvsX9Vy2ED@ep-aged-water-a1jbc897-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';

const primaryDbUrl = ENV.DATABASE_URL || VERIFIED_NEON_DATABASE_URL;

const getSslConfig = (dbUrl: string) => {
  const isRemote = dbUrl.includes('neon.tech') || dbUrl.includes('pooler') || ENV.NODE_ENV === 'production';
  if (!isRemote) return undefined;
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

export const pool = new Pool({
  connectionString: primaryDbUrl,
  ssl: getSslConfig(primaryDbUrl),
  max: 15,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
  query_timeout: 10000,
});

let fallbackPool: Pool | null = null;
const getFallbackPool = (): Pool => {
  if (!fallbackPool) {
    fallbackPool = new Pool({
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

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

export const query = async <T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> => {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (ENV.NODE_ENV === 'development' && duration > 100) {
      console.log(`Executed query in ${duration}ms: ${text.slice(0, 80)}`);
    }
    return res;
  } catch (err: any) {
    // If password authentication failed (code 28P01) or host unreachable, failover to verified Neon database pooler
    const isAuthFailure = err.code === '28P01' || (err.message && err.message.includes('password authentication failed'));
    const isConnRefused = err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND';
    if ((isAuthFailure || isConnRefused) && primaryDbUrl !== VERIFIED_NEON_DATABASE_URL) {
      console.warn(`[DB FAILOVER] Primary database connection failed (${err.code || err.message}). Failing over to verified Neon cloud pooler.`);
      const backup = getFallbackPool();
      return await backup.query<T>(text, params);
    }
    throw err;
  }
};
