import { select } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import { importFromCJ } from '../../dropshipping/services/ProductImportService.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const { supplierId, supplierProductId, categoryId, markupType, markupValue } = request.body;

  const suppliers = await select('*')
    .from('dropshipping_supplier')
    .where('supplier_id', '=', supplierId)
    .execute(pool);

  if (!suppliers.length) {
    response.status(404);
    response.$body = { error: { status: 404, message: 'Supplier not found' } };
    return next();
  }

  const supplier = suppliers[0];
  const config = typeof supplier.config === 'string' ? JSON.parse(supplier.config) : supplier.config || {};

  try {
    let result;
    if (supplier.type === 'cjdropshipping') {
      result = await importFromCJ({
        productId: supplierProductId,
        supplierId,
        categoryId: categoryId || null,
        apiKey: supplier.api_key,
        apiPassword: config.api_password || supplier.api_secret,
        markupType: markupType || 'percentage',
        markupValue: parseFloat(markupValue || 80)
      });
    } else {
      response.status(422);
      response.$body = {
        error: {
          status: 422,
          message: `Auto-import not supported for supplier type: ${supplier.type}. Use manual product creation.`
        }
      };
      return next();
    }

    response.status(OK);
    response.$body = { data: result };
    next();
  } catch (error) {
    response.status(422);
    response.$body = { error: { status: 422, message: error.message } };
    next();
  }
};
