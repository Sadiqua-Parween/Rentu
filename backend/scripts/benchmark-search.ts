import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

interface LatencyStats {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

function calculatePercentiles(durations: number[]): LatencyStats {
  const sorted = [...durations].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avg = sum / sorted.length;
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  return { min, max, avg, p50, p95, p99 };
}

async function runBenchmark() {
  console.log('⚡ Rentu⁺ Multi-Attribute Search Query Benchmark');
  console.log('====================================================');
  console.log(`Database: PostgreSQL (${process.env.DATABASE_URL ? 'Connected' : 'Missing URL'})`);

  const client = await pool.connect();

  try {
    // Ensure composite index exists
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_items_search_composite 
      ON items(status, category, price_per_day) 
      WHERE is_deleted = false;
    `);

    const testQuery = `
      SELECT id, title, category, price_per_day, locality
      FROM items
      WHERE status = 'AVAILABLE'
        AND category = 'Electronics & Tech'
        AND price_per_day <= 1500
        AND COALESCE(is_deleted, false) = false
      ORDER BY created_at DESC
      LIMIT 20;
    `;

    const iterations = 50;

    // 1. Benchmark WITHOUT Indexes (Forced Seq Scan)
    console.log('\n📊 1. Running Benchmark WITHOUT Index (Sequential Scan Simulation)...');
    await client.query('SET enable_indexscan = off;');
    await client.query('SET enable_bitmapscan = off;');

    // Warm-up query
    await client.query(testQuery);

    const withoutIndexPlan = await client.query(`EXPLAIN (ANALYZE, BUFFERS) ${testQuery}`);
    const withoutIndexTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await client.query(testQuery);
      withoutIndexTimes.push(performance.now() - start);
    }
    const statsWithout = calculatePercentiles(withoutIndexTimes);

    // 2. Benchmark WITH Composite Index
    console.log('📊 2. Running Benchmark WITH Composite Index (Index Scan)...');
    await client.query('SET enable_indexscan = on;');
    await client.query('SET enable_bitmapscan = on;');

    // Warm-up query
    await client.query(testQuery);

    const withIndexPlan = await client.query(`EXPLAIN (ANALYZE, BUFFERS) ${testQuery}`);
    const withIndexTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await client.query(testQuery);
      withIndexTimes.push(performance.now() - start);
    }
    const statsWith = calculatePercentiles(withIndexTimes);

    console.log('\n====================================================');
    console.log('📈 Benchmark Results Summary (' + iterations + ' iterations each):');
    console.log('----------------------------------------------------');
    console.log('| Metric           | Unindexed (Seq Scan) | Composite Index (B-Tree) | Speedup |');
    console.log('| :--------------- | :------------------- | :----------------------- | :------ |');
    console.log(
      `| Average Latency  | ${statsWithout.avg.toFixed(2)} ms`.padEnd(23) +
      `| ${statsWith.avg.toFixed(2)} ms`.padEnd(27) +
      `| ${(statsWithout.avg / Math.max(statsWith.avg, 0.01)).toFixed(1)}x faster |`
    );
    console.log(
      `| Median (p50)     | ${statsWithout.p50.toFixed(2)} ms`.padEnd(23) +
      `| ${statsWith.p50.toFixed(2)} ms`.padEnd(27) +
      `| ${(statsWithout.p50 / Math.max(statsWith.p50, 0.01)).toFixed(1)}x faster |`
    );
    console.log(
      `| 95th Percentile  | ${statsWithout.p95.toFixed(2)} ms`.padEnd(23) +
      `| ${statsWith.p95.toFixed(2)} ms`.padEnd(27) +
      `| ${(statsWithout.p95 / Math.max(statsWith.p95, 0.01)).toFixed(1)}x faster |`
    );
    console.log(
      `| 99th Percentile  | ${statsWithout.p99.toFixed(2)} ms`.padEnd(23) +
      `| ${statsWith.p99.toFixed(2)} ms`.padEnd(27) +
      `| ${(statsWithout.p99 / Math.max(statsWith.p99, 0.01)).toFixed(1)}x faster |`
    );
    console.log('====================================================');

    console.log('\n🔍 EXPLAIN Plan with Composite Index:');
    withIndexPlan.rows.slice(0, 5).forEach((r: any) => console.log('  ' + r['QUERY PLAN']));

  } catch (err) {
    console.error('Benchmark error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runBenchmark();
