import { insert } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const { name, type, apiKey, apiSecret, apiEndpoint, config } = request.body;

  try {
    const result = await insert('dropshipping_supplier')
      .given({
        name,
        type: type || 'custom',
        api_key: apiKey || null,
        api_secret: apiSecret || null,
        api_endpoint: apiEndpoint || null,
        status: true,
        config: config ? JSON.stringify(config) : '{}'
      })
      .execute(pool);

    const supplierId = result.rows[0]?.supplier_id;

    response.status(OK);
    response.$body = {
      data: { supplierId, name, type, message: 'Supplier added successfully' }
    };
    next();
  } catch (error) {
    response.status(422);
    response.$body = { error: { status: 422, message: error.message } };
    next();
  }
};
