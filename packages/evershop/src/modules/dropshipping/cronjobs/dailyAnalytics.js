/**
 * Daily Analytics Snapshot Cron Job
 *
 * Runs at midnight to:
 * - Aggregate daily profit/revenue/cost by supplier
 * - Store in dropshipping_analytics table for fast reporting
 *
 * Schedule: 0 0 * * * (daily at midnight)
 */
import { select, insert } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';

export const schedule = '0 0 * * *';

export default async () => {
  console.log('[Dropshipping Cron] Generating daily analytics snapshot...');
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().substring(0, 10);

    // Aggregate by supplier
    const stats = await select(
      `supplier_id,
       COUNT(*) as orders_count,
       SUM(CASE WHEN status != 'failed' THEN 1 ELSE 0 END) as successful_orders,
       COALESCE(SUM(cost), 0) as total_cost,
       COALESCE(SUM(profit), 0) as total_profit`
    )
      .from('dropshipping_order')
      .where('DATE(created_at)', '=', dateStr)
      .groupBy('supplier_id')
      .execute(pool);

    for (const stat of stats) {
      // Upsert analytics record
      await pool.query(
        `INSERT INTO dropshipping_analytics (date, supplier_id, orders_count, cost, profit)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (date, supplier_id) DO UPDATE
           SET orders_count = EXCLUDED.orders_count,
               cost = EXCLUDED.cost,
               profit = EXCLUDED.profit`,
        [
          dateStr,
          stat.supplier_id,
          parseInt(stat.orders_count),
          parseFloat(stat.total_cost),
          parseFloat(stat.total_profit)
        ]
      );
    }

    console.log(`[Dropshipping Cron] Saved analytics for ${stats.length} suppliers on ${dateStr}`);
  } catch (error) {
    console.error('[Dropshipping Cron] Analytics failed:', error.message);
  }
};
