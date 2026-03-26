import { insert } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const {
    name,
    supplierId,
    costFrom,
    costTo,
    markupType,
    markupValue,
    minProfit,
    roundTo,
    priority
  } = request.body;

  try {
    const result = await insert('dropshipping_pricing_rule')
      .given({
        name,
        supplier_id: supplierId || null,
        cost_from: parseFloat(costFrom || 0),
        cost_to: costTo !== undefined && costTo !== null ? parseFloat(costTo) : null,
        markup_type: markupType || 'percentage',
        markup_value: parseFloat(markupValue || 30),
        min_profit: parseFloat(minProfit || 0),
        round_to: parseFloat(roundTo || 0.99),
        priority: parseInt(priority || 0),
        is_active: true
      })
      .execute(pool);

    response.status(OK);
    response.$body = {
      data: { ruleId: result.rows[0]?.id, message: 'Pricing rule added' }
    };
    next();
  } catch (error) {
    response.status(422);
    response.$body = { error: { status: 422, message: error.message } };
    next();
  }
};
