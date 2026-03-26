/**
 * Product Import Service
 *
 * Imports products from external suppliers into EverShop catalog.
 * Handles: images, variants, pricing, categories, SEO.
 *
 * Automated workflow:
 * 1. Fetch product from supplier API
 * 2. Calculate selling price via PricingRuleService
 * 3. Create EverShop product with all data
 * 4. Download and store product images
 * 5. Create dropshipping_product mapping
 */
import { select, insert, update, getConnection, startTransaction, commit, rollback } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import CJDropshipping from './CJDropshippingService.js';
import { calculatePrice } from './PricingRuleService.js';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Import a product from CJDropshipping by product ID
 */
export async function importFromCJ({
  productId,
  supplierId,
  categoryId,
  apiKey,
  apiPassword,
  markupType = 'percentage',
  markupValue = 80
}) {
  const connection = await getConnection();
  try {
    await startTransaction(connection);

    // Fetch product details from CJ
    const cjProduct = await CJDropshipping.getProductDetails({
      productId,
      apiKey,
      apiPassword
    });

    if (!cjProduct) throw new Error('Product not found on CJDropshipping');

    const productData = Array.isArray(cjProduct) ? cjProduct[0] : cjProduct;

    // Calculate selling price from supplier cost
    const cost = parseFloat(productData.sellPrice || productData.originalPrice || 0);
    const sellingPrice = await calculatePrice(cost, supplierId);

    // Build product slug from name
    const slug = buildSlug(productData.productNameEn || productData.entryNameEn || 'product');

    // Create EverShop product
    const productResult = await insert('product')
      .given({
        uuid: crypto.randomUUID(),
        name: productData.productNameEn || productData.entryNameEn,
        description: productData.productDescription || productData.description || '',
        short_description: (productData.productDescription || '').substring(0, 300),
        url_key: slug,
        meta_title: productData.productNameEn,
        meta_description: (productData.productDescription || '').substring(0, 160),
        price: sellingPrice,
        qty: parseInt(productData.inventory || productData.productInventory || '100', 10),
        weight: parseFloat(productData.productWeight || '0.5'),
        status: 1,
        tax_class: null,
        visibility: 1,
        group_id: null
      })
      .execute(connection);

    const newProductId = productResult.rows[0]?.product_id;
    if (!newProductId) throw new Error('Failed to create product');

    // Assign to category if specified
    if (categoryId) {
      await insert('product_category')
        .given({ product_id: newProductId, category_id: categoryId })
        .execute(connection);
    }

    // Download and associate images
    const imageUrls = extractImageUrls(productData);
    for (let i = 0; i < Math.min(imageUrls.length, 8); i++) {
      try {
        await importProductImage(connection, newProductId, imageUrls[i], i === 0);
      } catch (imgErr) {
        console.warn('[Dropshipping] Image import failed:', imgErr.message);
      }
    }

    // Create dropshipping_product mapping
    await insert('dropshipping_product')
      .given({
        product_id: newProductId,
        supplier_id: supplierId,
        supplier_product_id: String(productId),
        supplier_variant_id: productData.vid || null,
        supplier_sku: productData.skuCode || null,
        supplier_cost: cost,
        markup_type: markupType,
        markup_value: markupValue,
        auto_price_sync: true,
        auto_stock_sync: true,
        is_digital: false,
        supplier_data: JSON.stringify(productData),
        last_synced_at: new Date().toISOString()
      })
      .execute(connection);

    await commit(connection);

    return {
      success: true,
      productId: newProductId,
      name: productData.productNameEn,
      cost,
      sellingPrice
    };
  } catch (error) {
    await rollback(connection);
    throw error;
  }
}

/**
 * Import a digital product (file or URL)
 */
export async function importDigitalProduct({
  name,
  description,
  price,
  categoryId,
  fileUrl,
  filePath,
  fileName,
  downloadLimit = 5,
  expiryDays = 30,
  licenseType = 'single'
}) {
  const connection = await getConnection();
  try {
    await startTransaction(connection);

    const slug = buildSlug(name);

    const productResult = await insert('product')
      .given({
        uuid: crypto.randomUUID(),
        name,
        description: description || '',
        short_description: (description || '').substring(0, 300),
        url_key: slug,
        meta_title: name,
        meta_description: (description || '').substring(0, 160),
        price,
        qty: 9999, // Infinite stock for digital
        weight: 0,
        status: 1,
        visibility: 1
      })
      .execute(connection);

    const newProductId = productResult.rows[0]?.product_id;
    if (!newProductId) throw new Error('Failed to create digital product');

    if (categoryId) {
      await insert('product_category')
        .given({ product_id: newProductId, category_id: categoryId })
        .execute(connection);
    }

    // Create digital product record
    await insert('dropshipping_digital_product')
      .given({
        product_id: newProductId,
        file_name: fileName || path.basename(fileUrl || filePath || 'download'),
        file_path: filePath || null,
        file_url: fileUrl || null,
        download_limit: downloadLimit,
        expiry_days: expiryDays,
        license_type: licenseType,
        delivery_method: fileUrl ? 'url' : filePath ? 'download' : 'license'
      })
      .execute(connection);

    // Create dropshipping_product mapping (marks as digital)
    await insert('dropshipping_product')
      .given({
        product_id: newProductId,
        supplier_id: null,
        supplier_product_id: `digital-${newProductId}`,
        supplier_cost: 0,
        markup_type: 'fixed',
        markup_value: price,
        is_digital: true,
        auto_price_sync: false,
        auto_stock_sync: false
      })
      .execute(connection);

    await commit(connection);

    return { success: true, productId: newProductId, name, price };
  } catch (error) {
    await rollback(connection);
    throw error;
  }
}

/**
 * Store product image reference in the database
 */
async function importProductImage(connection, productId, imageUrl, isMain = false) {
  await insert('product_image')
    .given({
      product_id: productId,
      image: imageUrl, // Store the supplier URL directly
      listing: isMain ? 1 : 0
    })
    .execute(connection);
}

/**
 * Extract all image URLs from a CJ product data object
 */
function extractImageUrls(productData) {
  const urls = [];
  if (productData.productImageSet) {
    try {
      const images = JSON.parse(productData.productImageSet);
      urls.push(...images.map((i) => i.imageUrl || i));
    } catch {
      // Not JSON array
    }
  }
  if (productData.productImage) urls.push(productData.productImage);
  if (productData.mainImage) urls.push(productData.mainImage);
  return [...new Set(urls.filter(Boolean))];
}

/**
 * Build URL-friendly slug from product name
 */
function buildSlug(name) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
  return `${base}-${Date.now().toString(36)}`;
}

export default {
  importFromCJ,
  importDigitalProduct
};
