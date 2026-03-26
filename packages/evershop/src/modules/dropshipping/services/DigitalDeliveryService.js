/**
 * Digital Product Delivery Service
 *
 * Handles instant delivery of digital products after payment:
 * - Software licenses
 * - eBooks, PDF guides
 * - Online courses (URLs)
 * - Digital art, templates
 * - Game keys
 *
 * Strategy for maximum profit:
 * - Source PLR (Private Label Rights) content for $1–5
 * - Sell at $9.99–$49.99 = 500–2000% margin
 * - Zero fulfillment cost, instant delivery
 */
import { select, insert, update } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { sendMail } from '../../../lib/mail/sendMail.js';

/**
 * Issue download tokens for all digital items in an order
 * Called after successful payment
 */
export async function issueDownloadTokens(orderId, customerEmail) {
  // Get all digital products in this order
  const orderItems = await select('oi.*, dp.product_id, ddp.*')
    .from('order_item oi')
    .leftJoin('dropshipping_digital_product ddp')
    .on('oi.product_id', '=', 'ddp.product_id')
    .where('oi.order_id', '=', orderId)
    .andWhere('ddp.id', 'IS NOT', null)
    .execute(pool);

  if (!orderItems.length) return [];

  // Get customer ID
  const orders = await select('customer_id')
    .from('"order"')
    .where('order_id', '=', orderId)
    .execute(pool);

  const customerId = orders[0]?.customer_id || null;
  const tokens = [];

  for (const item of orderItems) {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (item.expiry_days || 30));

    await insert('dropshipping_digital_download')
      .given({
        order_id: orderId,
        customer_id: customerId,
        digital_product_id: item.id,
        download_token: token,
        max_downloads: item.download_limit || 5,
        expires_at: expiresAt.toISOString()
      })
      .execute(pool);

    tokens.push({
      token,
      fileName: item.file_name,
      expiresAt,
      productId: item.product_id,
      deliveryMethod: item.delivery_method,
      deliveryData: item.delivery_data
    });
  }

  // Send download email
  if (tokens.length > 0 && customerEmail) {
    await sendDownloadEmail(customerEmail, orderId, tokens);
  }

  return tokens;
}

/**
 * Process a download request and stream the file
 */
export async function processDownload(token) {
  const downloads = await select('*')
    .from('dropshipping_digital_download')
    .where('download_token', '=', token)
    .execute(pool);

  if (!downloads.length) {
    throw new Error('Invalid download token');
  }

  const dl = downloads[0];

  // Check expiry
  if (dl.expires_at && new Date(dl.expires_at) < new Date()) {
    throw new Error('Download link has expired');
  }

  // Check download limit
  if (dl.download_count >= dl.max_downloads) {
    throw new Error('Download limit reached');
  }

  // Get the digital product info
  const products = await select('*')
    .from('dropshipping_digital_product')
    .where('id', '=', dl.digital_product_id)
    .execute(pool);

  if (!products.length) {
    throw new Error('Digital product not found');
  }

  const product = products[0];

  // Increment download count
  await update('dropshipping_digital_download')
    .given({
      download_count: dl.download_count + 1,
      last_downloaded_at: new Date().toISOString()
    })
    .where('id', '=', dl.id)
    .execute(pool);

  // Return file info for streaming
  if (product.file_path && fs.existsSync(product.file_path)) {
    return {
      type: 'file',
      filePath: product.file_path,
      fileName: product.file_name || path.basename(product.file_path),
      mimeType: getMimeType(product.file_name)
    };
  }

  if (product.file_url) {
    return {
      type: 'url',
      redirectUrl: product.file_url,
      fileName: product.file_name
    };
  }

  if (product.delivery_method === 'license') {
    const licenseKey = generateLicenseKey(product.product_id, dl.order_id);
    return {
      type: 'license',
      licenseKey,
      deliveryData: product.delivery_data
    };
  }

  throw new Error('No download available for this product');
}

/**
 * Generate a unique license key for software products
 */
function generateLicenseKey(productId, orderId) {
  const raw = `${productId}-${orderId}-${Date.now()}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  // Format as XXXX-XXXX-XXXX-XXXX
  return hash
    .substring(0, 16)
    .toUpperCase()
    .replace(/(.{4})/g, '$1-')
    .replace(/-$/, '');
}

/**
 * Send email with download links to customer
 */
async function sendDownloadEmail(email, orderId, tokens) {
  const downloadLinks = tokens
    .map(
      (t) =>
        `<li><strong>${t.fileName || 'Your Download'}</strong>: ` +
        `<a href="${process.env.STORE_URL || ''}/download/${t.token}">Download Now</a> ` +
        `(expires ${t.expiresAt.toLocaleDateString()})</li>`
    )
    .join('');

  try {
    await sendMail({
      to: email,
      subject: `Your Digital Products - Order #${orderId}`,
      html: `
        <h2>Thank you for your purchase!</h2>
        <p>Your digital products are ready for download:</p>
        <ul>${downloadLinks}</ul>
        <p>Links expire after the shown date or after ${tokens[0]?.maxDownloads || 5} downloads.</p>
        <p>Need help? Contact our support team.</p>
      `
    });
  } catch (err) {
    console.error('[Dropshipping] Failed to send download email:', err.message);
  }
}

/**
 * Get MIME type from file name
 */
function getMimeType(fileName) {
  const ext = path.extname(fileName || '').toLowerCase();
  const mimeTypes = {
    '.pdf': 'application/pdf',
    '.zip': 'application/zip',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.epub': 'application/epub+zip',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

export default {
  issueDownloadTokens,
  processDownload
};
