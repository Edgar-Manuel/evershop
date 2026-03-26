/**
 * Dropshipping Module Bootstrap
 *
 * Registers:
 * - Event subscribers (auto-fulfillment, digital delivery)
 * - Cron jobs (inventory sync, tracking update, analytics)
 * - Navigation menu items
 * - Configuration schema
 */
import { addProcessor } from '../../lib/util/registry.js';
import { hookAfter } from '../../lib/util/hookable.js';
import cron from 'node-cron';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async () => {
  // ─── Configuration Schema ───────────────────────────────────────────────────
  addProcessor('configurationSchema', (schema) => {
    if (!schema.properties) schema.properties = {};
    schema.properties.dropshipping = {
      type: 'object',
      properties: {
        autoFulfill: { type: 'boolean', default: true },
        inventorySyncInterval: { type: 'string', default: '0 */6 * * *' },
        trackingUpdateInterval: { type: 'string', default: '0 */4 * * *' },
        digitalDownloadExpiry: { type: 'integer', default: 30 },
        notifyOnFulfillmentFail: { type: 'boolean', default: true }
      }
    };
    return schema;
  });

  // ─── Event Subscribers ───────────────────────────────────────────────────────
  // Auto-fulfill orders when payment is confirmed
  hookAfter('order_placed', async (orderData) => {
    try {
      const { autoFulfillOrder } = await import('./services/OrderFulfillmentService.js');
      const orderId = orderData?.order_id || orderData?.orderId;
      if (orderId) {
        // Run async — don't block order completion
        setImmediate(async () => {
          try {
            await autoFulfillOrder(orderId);
          } catch (err) {
            console.error('[Dropshipping] Auto-fulfill failed:', err.message);
          }
        });
      }
    } catch (err) {
      console.error('[Dropshipping] Failed to load fulfillment service:', err.message);
    }
  });

  // Issue digital downloads when payment received
  hookAfter('payment_status_updated', async (paymentData) => {
    if (paymentData?.status !== 'paid' && paymentData?.paymentStatus !== 'paid') return;
    try {
      const { issueDownloadTokens } = await import('./services/DigitalDeliveryService.js');
      const orderId = paymentData?.order_id || paymentData?.orderId;
      const email = paymentData?.customer_email || paymentData?.customerEmail;
      if (orderId) {
        setImmediate(async () => {
          try {
            await issueDownloadTokens(orderId, email);
          } catch (err) {
            console.error('[Dropshipping] Digital delivery failed:', err.message);
          }
        });
      }
    } catch (err) {
      console.error('[Dropshipping] Failed to load digital delivery service:', err.message);
    }
  });

  // ─── Cron Jobs ───────────────────────────────────────────────────────────────
  // Inventory sync — every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      const { syncAllInventory } = await import('./services/InventorySyncService.js');
      await syncAllInventory();
    } catch (err) {
      console.error('[Dropshipping Cron] Inventory sync error:', err.message);
    }
  });

  // Tracking update — every 4 hours
  cron.schedule('0 */4 * * *', async () => {
    try {
      const { syncAllTracking } = await import('./services/TrackingService.js');
      await syncAllTracking();
    } catch (err) {
      console.error('[Dropshipping Cron] Tracking sync error:', err.message);
    }
  });

  // Daily analytics snapshot — midnight
  cron.schedule('0 0 * * *', async () => {
    try {
      const { default: dailyAnalytics } = await import('./cronjobs/dailyAnalytics.js');
      await dailyAnalytics();
    } catch (err) {
      console.error('[Dropshipping Cron] Analytics snapshot error:', err.message);
    }
  });

  // ─── Admin Navigation ────────────────────────────────────────────────────────
  addProcessor('adminNavigationItems', (items) => {
    items.push({
      id: 'dropshipping',
      name: 'Dropshipping',
      icon: 'package',
      url: '/admin/dropshipping',
      children: [
        { id: 'dropshipping-dashboard', name: 'Dashboard', url: '/admin/dropshipping' },
        { id: 'dropshipping-suppliers', name: 'Suppliers', url: '/admin/dropshipping/suppliers' },
        { id: 'dropshipping-import', name: 'Import Products', url: '/admin/dropshipping/import' },
        { id: 'dropshipping-pricing', name: 'Pricing Rules', url: '/admin/dropshipping/pricing' },
        { id: 'dropshipping-digital', name: 'Digital Products', url: '/admin/dropshipping/digital' },
        { id: 'dropshipping-wizard', name: '✨ Quick Wizard', url: '/admin/dropshipping/wizard' }
      ]
    });
    return items;
  });

  console.log('[Dropshipping] Module initialized. Auto-fulfillment: active. Cron jobs: scheduled.');
};
