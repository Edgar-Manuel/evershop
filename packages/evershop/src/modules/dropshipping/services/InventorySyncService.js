/**
 * Inventory Sync Service
 *
 * Syncs stock levels and prices from suppliers to EverShop catalog.
 * Runs every 6 hours via cron job.
 *
 * Strategy:
 * - If supplier stock = 0, set product to out-of-stock
 * - If price changes > 5%, auto-update selling price
 * - Log all changes for audit trail
 */
import { select, update } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import CJDropshipping from './CJDropshippingService.js';
import { calculatePrice } from './PricingRuleService.js';

/**
 * Sync inventory for all dropshipping products
 */
export async function syncAllInventory() {
  console.log('[Dropshipping] Starting inventory sync...');

  // Get all active dropshipping product mappings
  const mappings = await select(
    'dp.*, ds.type, ds.api_key, ds.api_secret, ds.config'
  )
    .from('dropshipping_product dp')
    .leftJoin('dropshipping_supplier ds')
    .on('dp.supplier_id', '=', 'ds.supplier_id')
    .where('dp.auto_stock_sync', '=', true)
    .andWhere('ds.status', '=', true)
    .execute(pool);

  console.log(`[Dropshipping] Syncing ${mappings.length} products`);

  const results = { updated: 0, outOfStock: 0, priceUpdated: 0, errors: 0 };

  // Group by supplier for batch API calls
  const bySupplier = {};
  for (const m of mappings) {
    const key = m.supplier_id;
    if (!bySupplier[key]) bySupplier[key] = [];
    bySupplier[key].push(m);
  }

  for (const [supplierId, supplierMappings] of Object.entries(bySupplier)) {
    try {
      await syncSupplierInventory(supplierMappings, results);
    } catch (err) {
      console.error(`[Dropshipping] Supplier ${supplierId} sync error:`, err.message);
      results.errors += supplierMappings.length;
    }
  }

  console.log('[Dropshipping] Inventory sync complete:', results);
  return results;
}

/**
 * Sync inventory for a single supplier's products
 */
async function syncSupplierInventory(mappings, results) {
  const firstMapping = mappings[0];
  if (firstMapping.type !== 'cjdropshipping') {
    // For other supplier types, skip automated sync
    return;
  }

  const config =
    typeof firstMapping.config === 'string'
      ? JSON.parse(firstMapping.config)
      : firstMapping.config || {};

  // Get stock info for all SKUs in batch
  const skuIds = mappings
    .map((m) => m.supplier_variant_id || m.supplier_product_id)
    .filter(Boolean);

  if (!skuIds.length) return;

  let stockData = [];
  try {
    stockData = await CJDropshipping.getStockInfo({
      skuIds,
      apiKey: firstMapping.api_key,
      apiPassword: config.api_password || firstMapping.api_secret
    });
  } catch (err) {
    console.error('[Dropshipping] Stock API error:', err.message);
    return;
  }

  // Build a map of skuId -> stock info
  const stockMap = {};
  if (Array.isArray(stockData)) {
    for (const s of stockData) {
      stockMap[s.vid || s.skuId] = s;
    }
  }

  for (const mapping of mappings) {
    const skuId = mapping.supplier_variant_id || mapping.supplier_product_id;
    const stock = stockMap[skuId];
    if (!stock) continue;

    try {
      const newCost = parseFloat(stock.sellPrice || stock.price || mapping.supplier_cost);
      const oldCost = parseFloat(mapping.supplier_cost);
      const qty = parseInt(stock.inventory || stock.quantity || '0', 10);

      const updateData = { last_synced_at: new Date().toISOString() };

      // Update stock in product table
      if (qty === 0) {
        await update('product')
          .given({ stock_status: 0 })
          .where('product_id', '=', mapping.product_id)
          .execute(pool);
        results.outOfStock++;
      } else {
        await update('product')
          .given({ stock_status: 1, qty })
          .where('product_id', '=', mapping.product_id)
          .execute(pool);
        results.updated++;
      }

      // Auto-update price if changed by more than 5% and auto_price_sync is on
      if (mapping.auto_price_sync && Math.abs(newCost - oldCost) / oldCost > 0.05) {
        const newSellingPrice = await calculatePrice(newCost, mapping.supplier_id, mapping.is_digital);

        await update('product')
          .given({ price: newSellingPrice })
          .where('product_id', '=', mapping.product_id)
          .execute(pool);

        updateData.supplier_cost = newCost;
        results.priceUpdated++;
      }

      // Update last_synced_at
      await update('dropshipping_product')
        .given(updateData)
        .where('id', '=', mapping.id)
        .execute(pool);
    } catch (err) {
      console.error(`[Dropshipping] Failed to update product ${mapping.product_id}:`, err.message);
      results.errors++;
    }
  }
}

/**
 * Force-sync a single product
 */
export async function syncProduct(dropshippingProductId) {
  const mappings = await select('dp.*, ds.type, ds.api_key, ds.api_secret, ds.config')
    .from('dropshipping_product dp')
    .leftJoin('dropshipping_supplier ds')
    .on('dp.supplier_id', '=', 'ds.supplier_id')
    .where('dp.id', '=', dropshippingProductId)
    .execute(pool);

  if (!mappings.length) throw new Error('Dropshipping product not found');

  const results = { updated: 0, outOfStock: 0, priceUpdated: 0, errors: 0 };
  await syncSupplierInventory(mappings, results);
  return results;
}

export default {
  syncAllInventory,
  syncProduct
};
