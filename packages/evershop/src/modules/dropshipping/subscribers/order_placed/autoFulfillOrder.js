/**
 * Auto-fulfillment subscriber
 *
 * Fires when a new order is placed and payment is confirmed.
 * Automatically forwards the order to the appropriate supplier.
 *
 * This is the core of the "hands-free" dropshipping system.
 */
import { autoFulfillOrder } from '../../services/OrderFulfillmentService.js';

export default async ({ order_id }) => {
  if (!order_id) return;

  try {
    console.log(`[Dropshipping] Auto-fulfillment triggered for order ${order_id}`);
    const result = await autoFulfillOrder(order_id);
    if (result.fulfilled) {
      console.log(`[Dropshipping] Order ${order_id} fulfilled. Results:`, result.results);
    } else {
      console.log(`[Dropshipping] Order ${order_id} has no dropshipping items (${result.reason || 'skipped'})`);
    }
  } catch (error) {
    // Log but don't throw — order should still complete even if fulfillment fails
    console.error(`[Dropshipping] Auto-fulfillment error for order ${order_id}:`, error.message);
  }
};
