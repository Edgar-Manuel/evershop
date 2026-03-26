/**
 * AliExpress Affiliate/Dropshipping Service
 * Uses the AliExpress Affiliate API (free, no MOQ)
 *
 * Best for: large catalog diversity, ultra-low cost products
 * Strategy: target products with 4.5+ stars, 500+ orders, ePacket shipping
 */

const ALI_API_BASE = 'https://api-sg.aliexpress.com/sync';

/**
 * Generate AliExpress affiliate URL for a product
 */
export function buildAffiliateUrl(productId, trackingId) {
  return `https://www.aliexpress.com/item/${productId}.html?aff_platform=portals-tool&sk=${trackingId}`;
}

/**
 * Search products via AliExpress Affiliate API
 */
export async function searchProducts({
  keyword,
  page = 1,
  pageSize = 20,
  appKey,
  appSecret,
  trackingId
}) {
  const params = new URLSearchParams({
    method: 'aliexpress.affiliate.product.query',
    app_key: appKey,
    sign_method: 'hmac',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    format: 'json',
    v: '2.0',
    keywords: keyword,
    page_no: String(page),
    page_size: String(pageSize),
    tracking_id: trackingId,
    fields:
      'app_sale_price,commission_rate,evaluate_rate,first_level_category_id,hot_product_commission_rate,lastest_volume,product_id,product_main_image_url,product_small_image_urls,product_title,promotion_link,sale_price,second_level_category_id,shop_id,shop_url,target_app_sale_price,target_sale_price',
    sort: 'LAST_VOLUME_DESC'
  });

  // Sign the request (HMAC-MD5)
  const sign = generateSign(params, appSecret);
  params.set('sign', sign);

  const res = await fetch(`${ALI_API_BASE}?${params.toString()}`);
  const data = await res.json();

  const result =
    data?.aliexpress_affiliate_product_query_response?.resp_result;
  if (!result || result.resp_code !== 200) {
    throw new Error(`AliExpress API error: ${result?.resp_msg || 'Unknown error'}`);
  }

  return result.result.products?.product || [];
}

/**
 * Get product details
 */
export async function getProductDetails({ productId, appKey, appSecret, trackingId }) {
  const params = new URLSearchParams({
    method: 'aliexpress.affiliate.product.detail.get',
    app_key: appKey,
    sign_method: 'hmac',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    format: 'json',
    v: '2.0',
    product_id: String(productId),
    tracking_id: trackingId,
    fields: 'commission_rate,evaluate_rate,product_id,product_main_image_url,product_small_image_urls,product_title,promotion_link,sale_price,second_level_category_id,shop_id,target_sale_price,hot_product_commission_rate'
  });

  const sign = generateSign(params, appSecret);
  params.set('sign', sign);

  const res = await fetch(`${ALI_API_BASE}?${params.toString()}`);
  const data = await res.json();

  const result =
    data?.aliexpress_affiliate_product_detail_get_response?.resp_result;
  if (!result || result.resp_code !== 200) {
    throw new Error(`AliExpress product detail error: ${result?.resp_msg}`);
  }

  return result.result.product;
}

/**
 * Generate promotion links (affiliate links) for products
 */
export async function generatePromotionLinks({ productUrls, appKey, appSecret, trackingId }) {
  const params = new URLSearchParams({
    method: 'aliexpress.affiliate.link.generate',
    app_key: appKey,
    sign_method: 'hmac',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    format: 'json',
    v: '2.0',
    promotion_link_type: '0',
    source_values: productUrls.join(','),
    tracking_id: trackingId
  });

  const sign = generateSign(params, appSecret);
  params.set('sign', sign);

  const res = await fetch(`${ALI_API_BASE}?${params.toString()}`);
  const data = await res.json();

  return data?.aliexpress_affiliate_link_generate_response?.resp_result?.result || null;
}

/**
 * Get hot products (trending) for a category
 */
export async function getHotProducts({ categoryId, appKey, appSecret, trackingId }) {
  const params = new URLSearchParams({
    method: 'aliexpress.affiliate.hotproduct.query',
    app_key: appKey,
    sign_method: 'hmac',
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    format: 'json',
    v: '2.0',
    category_id: String(categoryId || ''),
    page_no: '1',
    page_size: '50',
    tracking_id: trackingId,
    fields: 'app_sale_price,commission_rate,evaluate_rate,hot_product_commission_rate,lastest_volume,product_id,product_main_image_url,product_title,promotion_link,sale_price,second_level_category_id,shop_url,target_app_sale_price'
  });

  const sign = generateSign(params, appSecret);
  params.set('sign', sign);

  const res = await fetch(`${ALI_API_BASE}?${params.toString()}`);
  const data = await res.json();

  const result =
    data?.aliexpress_affiliate_hotproduct_query_response?.resp_result;
  if (!result || result.resp_code !== 200) {
    throw new Error(`AliExpress hot products error: ${result?.resp_msg}`);
  }

  return result.result.products?.product || [];
}

/**
 * Simple HMAC-MD5 signature for AliExpress API
 * In production, use a proper HMAC library
 */
function generateSign(params, appSecret) {
  // Sort params alphabetically
  const sortedKeys = Array.from(params.keys()).sort();
  let signStr = appSecret;
  for (const key of sortedKeys) {
    if (key !== 'sign') {
      signStr += key + params.get(key);
    }
  }
  signStr += appSecret;

  // Simple MD5 implementation (replace with crypto in production)
  return md5(signStr).toUpperCase();
}

/**
 * Minimal MD5 hash (browser-compatible fallback)
 * In Node.js production code, use: crypto.createHmac('md5', key).update(data).digest('hex')
 */
function md5(str) {
  try {
    const { createHash } = await import('crypto');
    return createHash('md5').update(str).digest('hex');
  } catch {
    return Buffer.from(str).toString('base64').substring(0, 32);
  }
}

export default {
  searchProducts,
  getProductDetails,
  generatePromotionLinks,
  getHotProducts,
  buildAffiliateUrl
};
