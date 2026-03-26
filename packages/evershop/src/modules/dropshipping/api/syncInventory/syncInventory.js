import { syncAllInventory } from '../../dropshipping/services/InventorySyncService.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  try {
    const results = await syncAllInventory();
    response.status(OK);
    response.$body = {
      data: {
        message: 'Inventory sync completed',
        results
      }
    };
    next();
  } catch (error) {
    response.status(422);
    response.$body = { error: { status: 422, message: error.message } };
    next();
  }
};
