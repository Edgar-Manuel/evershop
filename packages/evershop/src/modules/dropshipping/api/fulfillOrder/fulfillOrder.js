import { manualFulfill } from '../../dropshipping/services/OrderFulfillmentService.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const orderId = parseInt(request.params.orderId, 10);

  try {
    const result = await manualFulfill(orderId);
    response.status(OK);
    response.$body = { data: result };
    next();
  } catch (error) {
    response.status(422);
    response.$body = { error: { status: 422, message: error.message } };
    next();
  }
};
