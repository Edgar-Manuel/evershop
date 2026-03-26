/**
 * Physical Product Trend Finder Service
 *
 * Combines multiple data sources to find high-opportunity physical products:
 * 1. CJDropshipping hot products API
 * 2. Google Trends validation
 * 3. Profitability scoring algorithm
 *
 * Scoring factors:
 * - Google Trend score (0–100): demand signal
 * - CJ sell count: proven sales velocity
 * - Margin potential: (suggested price - cost) / suggested price
 * - Competition score: lower is better
 * - Review score: quality signal
 */
import CJDropshipping from './CJDropshippingService.js';
import { getPhysicalTrends } from './TrendDiscoveryService.js';
import { calculatePrice } from './PricingRuleService.js';
import { select } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';

/**
 * Find the most profitable trending physical products for a given supplier
 * @param {string} supplierId - UUID of the supplier to search
 * @param {object} options - Search options
 */
export async function findTrendingProducts(supplierId, options = {}) {
  const {
    maxResults = 30,
    minMarginPercent = 50,
    maxCost = 50,
    niches = null // null = all niches
  } = options;

  // Get supplier config
  const suppliers = await select('*')
    .from('dropshipping_supplier')
    .where('supplier_id', '=', supplierId)
    .execute(pool);

  if (!suppliers.length) throw new Error('Supplier not found');

  const supplier = suppliers[0];
  const config = typeof supplier.config === 'string' ? JSON.parse(supplier.config) : supplier.config || {};

  // Get trend data for scoring
  let trendData = [];
  try {
    trendData = await getPhysicalTrends();
  } catch (err) {
    console.warn('[PhysicalTrends] Could not fetch Google Trends:', err.message);
  }

  const trendMap = {};
  trendData.forEach((t) => {
    t.cjKeywords?.forEach((kw) => {
      trendMap[kw.toLowerCase()] = t.trendScore;
    });
  });

  // Collect products from all trending niches
  const allProducts = [];
  const physicalNiches = niches || [
    'wireless earbuds',
    'LED strip lights',
    'resistance bands',
    'phone stand',
    'face roller',
    'dog toy',
    'kitchen organizer',
    'massage gun',
    'smart plug',
    'hair removal',
    'bluetooth speaker',
    'laptop stand',
    'posture corrector',
    'car accessories',
    'baby products'
  ];

  if (supplier.type === 'cjdropshipping') {
    for (const keyword of physicalNiches.slice(0, 8)) {
      try {
        const result = await CJDropshipping.searchProducts({
          keyword,
          page: 1,
          pageSize: 8,
          apiKey: supplier.api_key,
          apiPassword: config.api_password || supplier.api_secret
        });

        const list = result?.list || result?.productList || (Array.isArray(result) ? result : []);

        for (const product of list) {
          const cost = parseFloat(product.sellPrice || product.productPrice || 0);
          if (cost > maxCost || cost < 0.5) continue;

          const suggestedPrice = await calculatePrice(cost, supplierId);
          const margin = ((suggestedPrice - cost) / suggestedPrice) * 100;

          if (margin < minMarginPercent) continue;

          // Calculate trend score for this product
          const productName = (product.productNameEn || '').toLowerCase();
          let trendScore = 40;
          for (const [trendKw, score] of Object.entries(trendMap)) {
            if (productName.includes(trendKw)) {
              trendScore = Math.max(trendScore, score);
              break;
            }
          }

          // Opportunity score formula
          const sellCount = parseInt(product.sellCount || product.productSellCount || 0);
          const rating = parseFloat(product.productScore || product.score || 4.0);

          const opportunityScore = calculateOpportunityScore({
            trendScore,
            margin,
            sellCount,
            rating,
            cost
          });

          allProducts.push({
            id: product.pid || product.productId,
            name: product.productNameEn || product.entryNameEn,
            image: product.productImage || product.mainImage,
            cost,
            suggestedPrice,
            margin: Math.round(margin),
            trendScore,
            opportunityScore,
            sellCount,
            rating,
            keyword,
            supplierProductId: String(product.pid || product.productId),
            supplierId,
            inventory: product.productInventory || 'In Stock',
            category: keyword,
            isAlreadyImported: false
          });
        }
      } catch (err) {
        console.warn(`[PhysicalTrends] Search failed for "${keyword}":`, err.message);
      }
    }
  }

  // Check which products are already imported
  if (allProducts.length > 0) {
    const existingMappings = await select('supplier_product_id')
      .from('dropshipping_product')
      .where('supplier_id', '=', supplierId)
      .execute(pool);

    const importedIds = new Set(existingMappings.map((m) => m.supplier_product_id));
    allProducts.forEach((p) => {
      p.isAlreadyImported = importedIds.has(p.supplierProductId);
    });
  }

  // Remove duplicates by product ID
  const seen = new Set();
  const unique = allProducts.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });

  // Sort by opportunity score
  unique.sort((a, b) => b.opportunityScore - a.opportunityScore);

  return unique.slice(0, maxResults);
}

/**
 * Calculate a composite "opportunity score" for a product
 * Higher = more likely to be profitable
 *
 * Factors:
 * - Trend demand (Google Trends signal)
 * - Profit margin
 * - Proven sales (sell count from supplier)
 * - Product quality (rating)
 * - Price point sweetspot ($10–$40 converts best)
 */
function calculateOpportunityScore({ trendScore, margin, sellCount, rating, cost }) {
  // Normalize sell count (cap at 1000 for scoring)
  const normalizedSells = Math.min(sellCount / 1000, 1) * 100;

  // Price sweetspot: $10–$40 scores highest
  const priceSweetspot = cost >= 5 && cost <= 30 ? 20 : cost >= 3 && cost <= 50 ? 10 : 0;

  // Rating boost
  const ratingBoost = rating >= 4.5 ? 15 : rating >= 4.0 ? 8 : 0;

  return Math.round(
    trendScore * 0.35 +
    margin * 0.3 +
    normalizedSells * 0.2 +
    priceSweetspot +
    ratingBoost
  );
}

/**
 * Auto-find and import the top N trending products for a supplier
 * Called from the wizard's "Auto-Import Best Products" button
 */
export async function autoImportTopProducts(supplierId, count = 10) {
  const { importFromCJ } = await import('./ProductImportService.js');

  const trending = await findTrendingProducts(supplierId, { maxResults: count * 2 });
  const toImport = trending.filter((p) => !p.isAlreadyImported).slice(0, count);

  const results = [];
  for (const product of toImport) {
    try {
      const suppliers = await select('*')
        .from('dropshipping_supplier')
        .where('supplier_id', '=', supplierId)
        .execute(pool);
      const supplier = suppliers[0];
      const config = typeof supplier.config === 'string' ? JSON.parse(supplier.config) : supplier.config || {};

      const result = await importFromCJ({
        productId: product.supplierProductId,
        supplierId,
        apiKey: supplier.api_key,
        apiPassword: config.api_password || supplier.api_secret
      });
      results.push({ ...result, opportunityScore: product.opportunityScore });
    } catch (err) {
      results.push({ success: false, error: err.message, name: product.name });
    }
  }

  return results;
}

export default {
  findTrendingProducts,
  autoImportTopProducts
};
