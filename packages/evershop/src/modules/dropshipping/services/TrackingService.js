/**
 * Tracking Sync Service
 *
 * Polls suppliers for tracking updates on pending/submitted orders
 * and syncs them back to EverShop shipments.
 * Runs via cron job every 4 hours.
 */
import { select, update, insert } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import CJDropshipping from './CJDropshippingService.js';

/**
 * Sync tracking for all pending/submitted CJ dropshipping orders
 */
export async function syncAllTracking() {
  console.log('[Dropshipping] Starting tracking sync...');

  // Get all submitted orders that don't have tracking yet
  const pendingOrders = await select(
    'do.*, ds.api_key, ds.api_secret, ds.config, ds.type'
  )
    .from('dropshipping_order do')
    .leftJoin('dropshipping_supplier ds')
    .on('do.supplier_id', '=', 'ds.supplier_id')
    .where('do.status', '=', 'submitted')
    .andWhere('do.supplier_order_id', 'IS NOT', null)
    .execute(pool);

  console.log(`[Dropshipping] Syncing tracking for ${pendingOrders.length} orders`);

  let updated = 0;
  let failed = 0;

  for (const dsOrder of pendingOrders) {
    try {
      await syncOrderTracking(dsOrder);
      updated++;
    } catch (err) {
      console.error(
        `[Dropshipping] Failed to sync tracking for order ${dsOrder.supplier_order_id}:`,
        err.message
      );
      failed++;
    }
  }

  console.log(`[Dropshipping] Tracking sync done. Updated: ${updated}, Failed: ${failed}`);
  return { updated, failed };
}

/**
 * Sync tracking for a single dropshipping order
 */
async function syncOrderTracking(dsOrder) {
  if (dsOrder.type !== 'cjdropshipping') return;

  const config = typeof dsOrder.config === 'string' ? JSON.parse(dsOrder.config) : dsOrder.config || {};

  let trackingData;
  try {
    trackingData = await CJDropshipping.getTrackingInfo({
      supplierOrderId: dsOrder.supplier_order_id,
      apiKey: dsOrder.api_key,
      apiPassword: config.api_password || dsOrder.api_secret
    });
  } catch {
    // Order may not be shipped yet
    return;
  }

  if (!trackingData || !trackingData.trackingNumber) return;

  const newStatus = mapCJStatusToInternal(trackingData.logisticStatus);

  // Update dropshipping_order with tracking info
  await update('dropshipping_order')
    .given({
      tracking_number: trackingData.trackingNumber,
      carrier: trackingData.logisticCompany || 'Unknown',
      status: newStatus,
      updated_at: new Date().toISOString(),
      shipped_at:
        newStatus === 'shipped' && !dsOrder.shipped_at
          ? new Date().toISOString()
          : dsOrder.shipped_at,
      delivered_at:
        newStatus === 'delivered' && !dsOrder.delivered_at
          ? new Date().toISOString()
          : dsOrder.delivered_at
    })
    .where('id', '=', dsOrder.id)
    .execute(pool);

  // If we have a tracking number, create/update EverShop shipment
  if (trackingData.trackingNumber && dsOrder.order_id) {
    await upsertEverShopShipment(
      dsOrder.order_id,
      trackingData.trackingNumber,
      trackingData.logisticCompany || 'Unknown'
    );
  }
}

/**
 * Create or update a shipment record in EverShop OMS
 */
async function upsertEverShopShipment(orderId, trackingNumber, carrier) {
  try {
    // Check if shipment already exists for this order
    const existing = await select('*')
      .from('shipment')
      .where('order_id', '=', orderId)
      .execute(pool);

    if (existing.length > 0) {
      await update('shipment')
        .given({ tracking_number: trackingNumber, carrier_code: carrier })
        .where('order_id', '=', orderId)
        .execute(pool);
    } else {
      await insert('shipment')
        .given({
          order_id: orderId,
          tracking_number: trackingNumber,
          carrier_code: carrier
        })
        .execute(pool);
    }
  } catch (err) {
    // Shipment table may have different schema - log and continue
    console.warn('[Dropshipping] Could not update EverShop shipment:', err.message);
  }
}

/**
 * Map CJDropshipping logistic statuses to internal statuses
 */
function mapCJStatusToInternal(cjStatus) {
  const statusMap = {
    CREATED: 'submitted',
    IN_PROCESSING: 'processing',
    SHIPPED: 'shipped',
    TRANSIT: 'shipped',
    IN_TRANSIT: 'shipped',
    DELIVERED: 'delivered',
    EXCEPTION: 'failed'
  };
  return statusMap[cjStatus?.toUpperCase()] || 'submitted';
}

export default {
  syncAllTracking,
  syncOrderTracking
};
