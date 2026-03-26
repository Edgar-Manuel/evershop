/**
 * Tracking Update Cron Job
 *
 * Runs every 4 hours to:
 * - Check tracking status for all submitted orders
 * - Update EverShop shipments with tracking numbers
 * - Mark delivered orders as complete
 * - Alert on failed/exception shipments
 *
 * Schedule: 0 */4 * * * (every 4 hours)
 */
import { syncAllTracking } from '../services/TrackingService.js';

export const schedule = '0 */4 * * *';

export default async () => {
  console.log('[Dropshipping Cron] Running tracking update...');
  try {
    const results = await syncAllTracking();
    console.log('[Dropshipping Cron] Tracking update results:', results);
  } catch (error) {
    console.error('[Dropshipping Cron] Tracking update failed:', error.message);
  }
};
