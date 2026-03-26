/**
 * Automated Order Fulfillment Service
 *
 * When a customer places an order, this service:
 * 1. Identifies which items are from dropshipping suppliers
 * 2. Automatically places orders with the appropriate suppliers
 * 3. Records supplier order IDs for tracking
 * 4. Calculates profit per order
 */
import {
  select,
  insert,
  update,
  startTransaction,
  commit,
  rollback,
  getConnection
} from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import CJDropshipping from './CJDropshippingService.js';
import { calculateProfit } from './PricingRuleService.js';
import { sendMail } from '../../../lib/mail/sendMail.js';

/**
 * Attempt to auto-fulfill an order with all configured suppliers
 * Called from the order_placed event subscriber
 */
export async function autoFulfillOrder(orderId) {
  const connection = await getConnection();
  try {
    await startTransaction(connection);

    // Get order details
    const orders = await select('*')
      .from('"order"')
      .where('order_id', '=', orderId)
      .execute(connection);

    if (!orders.length) {
      throw new Error(`Order ${orderId} not found`);
    }

    const order = orders[0];

    // Get order items
    const items = await select('*')
      .from('order_item')
      .where('order_id', '=', orderId)
      .execute(connection);

    if (!items.length) {
      await rollback(connection);
      return { fulfilled: false, reason: 'No items' };
    }

    // For each item, check if there's a dropshipping product mapping
    const results = [];
    for (const item of items) {
      const mappings = await select('dp.*, ds.type, ds.api_key, ds.api_secret, ds.config, ds.name as supplier_name')
        .from('dropshipping_product dp')
        .leftJoin('dropshipping_supplier ds')
        .on('dp.supplier_id', '=', 'ds.supplier_id')
        .where('dp.product_id', '=', item.product_id)
        .andWhere('ds.status', '=', true)
        .execute(connection);

      if (!mappings.length) continue;

      const mapping = mappings[0];
      const result = await fulfillItemWithSupplier(order, item, mapping, connection);
      results.push(result);
    }

    await commit(connection);

    return {
      fulfilled: results.length > 0,
      results,
      orderId
    };
  } catch (error) {
    await rollback(connection);
    console.error(`[Dropshipping] Auto-fulfillment failed for order ${orderId}:`, error.message);

    // Record the failure
    try {
      await insert('dropshipping_order')
        .given({
          order_id: orderId,
          status: 'failed',
          error_message: error.message
        })
        .execute(pool);
    } catch (e) {
      // Ignore secondary error
    }

    throw error;
  }
}

/**
 * Submit a single order item to its supplier
 */
async function fulfillItemWithSupplier(order, item, mapping, connection) {
  // Get shipping address
  const addresses = await select('*')
    .from('order_address')
    .where('order_id', '=', order.order_id)
    .andWhere('address_type', '=', 'shipping')
    .execute(connection);

  const addr = addresses[0];
  if (!addr) {
    return { success: false, error: 'No shipping address' };
  }

  const shippingAddress = {
    firstName: addr.first_name,
    lastName: addr.last_name,
    address1: addr.address_1,
    address2: addr.address_2,
    city: addr.city,
    province: addr.province,
    postcode: addr.postcode,
    countryCode: addr.country_code,
    country: addr.country,
    phone: addr.telephone
  };

  let supplierOrderId = null;
  let status = 'pending';
  let errorMessage = null;
  let cost = parseFloat(mapping.supplier_cost) * item.qty_ordered;

  try {
    if (mapping.type === 'cjdropshipping') {
      const config = typeof mapping.config === 'string' ? JSON.parse(mapping.config) : mapping.config;
      const cjResult = await CJDropshipping.createOrder({
        orderClientId: `${order.order_id}-${item.order_item_id}`,
        shippingAddress,
        products: [
          {
            supplierVariantId: mapping.supplier_variant_id || mapping.supplier_product_id,
            quantity: item.qty_ordered
          }
        ],
        apiKey: mapping.api_key,
        apiPassword: config?.api_password || mapping.api_secret
      });

      supplierOrderId = cjResult?.orderId || cjResult?.order_id;
      status = 'submitted';
    } else if (mapping.type === 'aliexpress') {
      // AliExpress doesn't have an automated order API — flag for manual review
      status = 'manual_required';
      errorMessage = 'AliExpress orders require manual placement. Check admin panel.';
    } else if (mapping.type === 'digital') {
      // Digital products are auto-fulfilled via the digital delivery service
      status = 'shipped';
    } else {
      // Custom supplier — set pending for manual fulfillment
      status = 'pending';
    }
  } catch (err) {
    status = 'failed';
    errorMessage = err.message;
  }

  // Record in dropshipping_order
  const profit = calculateProfit(
    parseFloat(item.final_price) * item.qty_ordered,
    cost
  ).profit;

  await insert('dropshipping_order')
    .given({
      order_id: order.order_id,
      supplier_id: mapping.supplier_id,
      supplier_order_id: supplierOrderId,
      status,
      cost,
      profit,
      error_message: errorMessage,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null
    })
    .execute(connection);

  return { success: status !== 'failed', status, supplierOrderId, cost, profit };
}

/**
 * Manually trigger fulfillment for a specific order
 */
export async function manualFulfill(orderId) {
  return autoFulfillOrder(orderId);
}

/**
 * Update the status of a dropshipping order
 */
export async function updateDropshippingOrderStatus(dropshippingOrderId, status, extra = {}) {
  await update('dropshipping_order')
    .given({ status, updated_at: new Date().toISOString(), ...extra })
    .where('id', '=', dropshippingOrderId)
    .execute(pool);
}

export default {
  autoFulfillOrder,
  manualFulfill,
  updateDropshippingOrderStatus
};
