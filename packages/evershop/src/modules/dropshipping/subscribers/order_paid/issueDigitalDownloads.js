/**
 * Digital Download Delivery Subscriber
 *
 * Fires after payment is confirmed.
 * Issues download tokens and emails them to the customer.
 *
 * For digital products, this is the complete fulfillment step.
 */
import { issueDownloadTokens } from '../../services/DigitalDeliveryService.js';
import { select } from '@evershop/postgres-query-builder';
import { pool } from '../../../../lib/postgres/connection.js';

export default async ({ order_id }) => {
  if (!order_id) return;

  try {
    // Get customer email
    const orders = await select('o.customer_email, o.customer_full_name')
      .from('"order" o')
      .where('o.order_id', '=', order_id)
      .execute(pool);

    if (!orders.length) return;

    const { customer_email } = orders[0];

    const tokens = await issueDownloadTokens(order_id, customer_email);

    if (tokens.length > 0) {
      console.log(
        `[Dropshipping] Issued ${tokens.length} digital download token(s) for order ${order_id} to ${customer_email}`
      );
    }
  } catch (error) {
    console.error(
      `[Dropshipping] Digital delivery failed for order ${order_id}:`,
      error.message
    );
  }
};
