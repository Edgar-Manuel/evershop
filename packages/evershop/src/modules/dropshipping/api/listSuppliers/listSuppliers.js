import { select } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const suppliers = await select(
    'supplier_id, name, type, api_endpoint, status, created_at, updated_at'
  )
    .from('dropshipping_supplier')
    .orderBy('created_at', 'DESC')
    .execute(pool);

  // For each supplier, count their products
  const enriched = await Promise.all(
    suppliers.map(async (s) => {
      const countResult = await select('COUNT(*) as count')
        .from('dropshipping_product')
        .where('supplier_id', '=', s.supplier_id)
        .execute(pool);

      return {
        ...s,
        productCount: parseInt(countResult[0]?.count || '0', 10)
      };
    })
  );

  response.status(OK);
  response.$body = { data: { suppliers: enriched } };
  next();
};
