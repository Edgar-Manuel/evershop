/**
 * CJDropshipping API Service
 * Docs: https://developers.cjdropshipping.com/api2.0/
 *
 * The most cost-effective supplier for physical dropshipping:
 * - No subscription fee
 * - Ships from US/CN warehouses
 * - Built-in white-label packaging
 */
import { getConfig } from '../../../lib/util/getConfig.js';

const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

let _accessToken = null;
let _tokenExpiresAt = 0;

/**
 * Authenticate with CJDropshipping and get access token
 */
async function getAccessToken(apiKey, apiPassword) {
  const now = Date.now();
  if (_accessToken && _tokenExpiresAt > now + 60000) {
    return _accessToken;
  }

  const res = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: apiKey, password: apiPassword })
  });

  const data = await res.json();
  if (!data.result || !data.data?.accessToken) {
    throw new Error(`CJDropshipping auth failed: ${data.message || 'Unknown error'}`);
  }

  _accessToken = data.data.accessToken;
  // Token valid for 24h
  _tokenExpiresAt = now + 23 * 60 * 60 * 1000;
  return _accessToken;
}

/**
 * Generic CJ API request
 */
async function cjRequest(method, path, body, apiKey, apiPassword) {
  const token = await getAccessToken(apiKey, apiPassword);

  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'CJ-Access-Token': token
    }
  };
  if (body) options.body = JSON.stringify(body);

  const url = `${CJ_BASE_URL}${path}`;
  const res = await fetch(url, options);
  const data = await res.json();

  if (!data.result) {
    throw new Error(`CJ API error [${path}]: ${data.message || JSON.stringify(data)}`);
  }
  return data.data;
}

/**
 * Search products by keyword
 */
export async function searchProducts({ keyword, page = 1, pageSize = 20, apiKey, apiPassword }) {
  return cjRequest(
    'GET',
    `/product/query?productNameEn=${encodeURIComponent(keyword)}&pageNum=${page}&pageSize=${pageSize}`,
    null,
    apiKey,
    apiPassword
  );
}

/**
 * Get full product details including variants and images
 */
export async function getProductDetails({ productId, apiKey, apiPassword }) {
  return cjRequest('GET', `/product/query?pid=${productId}`, null, apiKey, apiPassword);
}

/**
 * Get product variants
 */
export async function getProductVariants({ productId, apiKey, apiPassword }) {
  return cjRequest(
    'GET',
    `/product/getVariants?pid=${productId}`,
    null,
    apiKey,
    apiPassword
  );
}

/**
 * Get current stock levels for a list of SKUs
 */
export async function getStockInfo({ skuIds, apiKey, apiPassword }) {
  return cjRequest(
    'POST',
    `/product/stock/queryBySkuIds`,
    { skuIds },
    apiKey,
    apiPassword
  );
}

/**
 * Create a dropshipping order with CJDropshipping
 */
export async function createOrder({
  orderClientId,
  shippingAddress,
  products,
  shippingMethod = 'CJPacket Ordinary',
  apiKey,
  apiPassword
}) {
  const payload = {
    orderClientId: String(orderClientId),
    shippingZip: shippingAddress.postcode,
    shippingCountryCode: shippingAddress.countryCode,
    shippingCountry: shippingAddress.country,
    shippingProvince: shippingAddress.province,
    shippingCity: shippingAddress.city,
    shippingAddress: shippingAddress.address1,
    shippingAddress2: shippingAddress.address2 || '',
    shippingCustomerName: `${shippingAddress.firstName} ${shippingAddress.lastName}`,
    shippingPhone: shippingAddress.phone || '',
    remark: 'No invoice. Ship as dropshipping.',
    fromCountryCode: 'CN',
    products: products.map((p) => ({
      vid: p.supplierVariantId,
      quantity: p.quantity,
      shippingName: shippingMethod
    }))
  };

  return cjRequest('POST', `/order/createOrderV2`, payload, apiKey, apiPassword);
}

/**
 * Get order status from CJDropshipping
 */
export async function getOrderStatus({ supplierOrderId, apiKey, apiPassword }) {
  return cjRequest(
    'GET',
    `/order/getOrderDetail?orderId=${supplierOrderId}`,
    null,
    apiKey,
    apiPassword
  );
}

/**
 * Get tracking information for an order
 */
export async function getTrackingInfo({ supplierOrderId, apiKey, apiPassword }) {
  return cjRequest(
    'GET',
    `/logistic/queryTrackingInfo?orderId=${supplierOrderId}`,
    null,
    apiKey,
    apiPassword
  );
}

/**
 * List available shipping methods for a product/destination
 */
export async function getShippingMethods({ countryCode, productId, quantity = 1, apiKey, apiPassword }) {
  return cjRequest(
    'GET',
    `/logistic/freightCalculate?countryCode=${countryCode}&vid=${productId}&quantity=${quantity}`,
    null,
    apiKey,
    apiPassword
  );
}

export default {
  searchProducts,
  getProductDetails,
  getProductVariants,
  getStockInfo,
  createOrder,
  getOrderStatus,
  getTrackingInfo,
  getShippingMethods
};
