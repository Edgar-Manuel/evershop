/**
 * Inventory Sync Cron Job
 *
 * Runs every 6 hours to:
 * - Update stock levels from suppliers
 * - Update prices if supplier cost changed significantly
 * - Mark out-of-stock products as unavailable
 *
 * Schedule: 0 */6 * * * (every 6 hours)
 */
import { syncAllInventory } from '../services/InventorySyncService.js';

export const schedule = '0 */6 * * *';

export default async () => {
  console.log('[Dropshipping Cron] Running inventory sync...');
  try {
    const results = await syncAllInventory();
    console.log('[Dropshipping Cron] Inventory sync results:', results);
  } catch (error) {
    console.error('[Dropshipping Cron] Inventory sync failed:', error.message);
  }
};
