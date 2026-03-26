import { update, select } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const supplierId = request.params.id;
  const { name, type, apiKey, apiSecret, apiEndpoint, status, config } = request.body;

  const suppliers = await select('*')
    .from('dropshipping_supplier')
    .where('supplier_id', '=', supplierId)
    .execute(pool);

  if (!suppliers.length) {
    response.status(404);
    response.$body = { error: { status: 404, message: 'Supplier not found' } };
    return next();
  }

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;
  if (apiKey !== undefined) updateData.api_key = apiKey;
  if (apiSecret !== undefined) updateData.api_secret = apiSecret;
  if (apiEndpoint !== undefined) updateData.api_endpoint = apiEndpoint;
  if (status !== undefined) updateData.status = status;
  if (config !== undefined) updateData.config = JSON.stringify(config);
  updateData.updated_at = new Date().toISOString();

  await update('dropshipping_supplier')
    .given(updateData)
    .where('supplier_id', '=', supplierId)
    .execute(pool);

  response.status(OK);
  response.$body = { data: { supplierId, message: 'Supplier updated' } };
  next();
};
