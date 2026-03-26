import { del, select } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const supplierId = request.params.id;

  const suppliers = await select('supplier_id')
    .from('dropshipping_supplier')
    .where('supplier_id', '=', supplierId)
    .execute(pool);

  if (!suppliers.length) {
    response.status(404);
    response.$body = { error: { status: 404, message: 'Supplier not found' } };
    return next();
  }

  await del('dropshipping_supplier')
    .where('supplier_id', '=', supplierId)
    .execute(pool);

  response.status(OK);
  response.$body = { data: { message: 'Supplier deleted' } };
  next();
};
