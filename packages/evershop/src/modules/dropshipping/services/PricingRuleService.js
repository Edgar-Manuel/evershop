/**
 * Dynamic Pricing Rule Engine
 *
 * Strategy for maximum profit:
 * - Products costing $0–$5: 200% markup (sell at $10–$15)
 * - Products costing $5–$20: 150% markup (sell at $12.50–$50)
 * - Products costing $20–$50: 80% markup (sell at $36–$90)
 * - Products costing $50+: 50% markup
 * - Digital products: 500–1000% markup (near-zero cost)
 *
 * Round to .99 cents for psychological pricing.
 */
import { select } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';

/**
 * Default markup tiers when no custom rule matches
 */
const DEFAULT_TIERS = [
  { costFrom: 0, costTo: 5, markupType: 'percentage', markupValue: 200, roundTo: 0.99 },
  { costFrom: 5, costTo: 20, markupType: 'percentage', markupValue: 150, roundTo: 0.99 },
  { costFrom: 20, costTo: 50, markupType: 'percentage', markupValue: 80, roundTo: 0.99 },
  { costFrom: 50, costTo: 200, markupType: 'percentage', markupValue: 50, roundTo: 0.99 },
  { costFrom: 200, costTo: null, markupType: 'percentage', markupValue: 30, roundTo: 0.99 }
];

/**
 * Calculate selling price from supplier cost using rules
 * @param {number} cost - Supplier cost in store currency
 * @param {string|null} supplierId - UUID of supplier (for custom rules)
 * @param {boolean} isDigital - Digital products get higher margins
 * @returns {number} Recommended selling price
 */
export async function calculatePrice(cost, supplierId = null, isDigital = false) {
  if (isDigital) {
    // Digital products: flat $9.99 minimum or 10x cost
    const price = Math.max(9.99, cost * 10);
    return roundPrice(price, 0.99);
  }

  // Try to find a matching custom rule
  try {
    let query = select('*').from('dropshipping_pricing_rule');
    query.where('is_active', '=', true);
    if (supplierId) {
      query.andWhere('supplier_id', '=', supplierId);
    }
    query.andWhere('cost_from', '<=', cost);
    const rules = await query.execute(pool);

    const matchingRules = rules.filter(
      (r) => r.cost_to === null || parseFloat(r.cost_to) >= cost
    );

    if (matchingRules.length > 0) {
      // Use highest-priority rule
      matchingRules.sort((a, b) => b.priority - a.priority);
      const rule = matchingRules[0];
      const price = applyMarkup(cost, rule.markup_type, parseFloat(rule.markup_value), parseFloat(rule.min_profit || 0));
      return roundPrice(price, parseFloat(rule.round_to || 0.99));
    }
  } catch (e) {
    // Fall through to defaults
  }

  // Apply default tiers
  const tier = DEFAULT_TIERS.find(
    (t) => cost >= t.costFrom && (t.costTo === null || cost < t.costTo)
  );

  if (tier) {
    const price = applyMarkup(cost, tier.markupType, tier.markupValue, 0);
    return roundPrice(price, tier.roundTo);
  }

  // Fallback: 50% markup
  return roundPrice(cost * 1.5, 0.99);
}

/**
 * Apply markup to a cost value
 */
function applyMarkup(cost, markupType, markupValue, minProfit) {
  let price;
  if (markupType === 'percentage') {
    price = cost * (1 + markupValue / 100);
  } else if (markupType === 'fixed') {
    price = cost + markupValue;
  } else {
    price = cost * 1.5;
  }
  // Ensure minimum profit
  if (minProfit > 0 && price - cost < minProfit) {
    price = cost + minProfit;
  }
  return price;
}

/**
 * Round price to psychological .99 cents
 * e.g., 23.45 → 22.99, 45.12 → 44.99
 */
function roundPrice(price, roundTo) {
  if (!roundTo || roundTo === 0) return Math.round(price * 100) / 100;
  const base = Math.floor(price);
  return base + roundTo;
}

/**
 * Calculate estimated profit for a sale
 */
export function calculateProfit(sellingPrice, supplierCost, shippingCost = 0, platformFee = 0.029) {
  const revenue = sellingPrice;
  const costs = supplierCost + shippingCost + revenue * platformFee;
  return {
    revenue,
    cost: costs,
    profit: revenue - costs,
    margin: ((revenue - costs) / revenue) * 100
  };
}

/**
 * Get all pricing rules for admin display
 */
export async function listPricingRules(supplierId = null) {
  let query = select('*').from('dropshipping_pricing_rule').orderBy('priority', 'DESC');
  if (supplierId) {
    query.where('supplier_id', '=', supplierId);
  }
  return query.execute(pool);
}

export default {
  calculatePrice,
  calculateProfit,
  listPricingRules
};
