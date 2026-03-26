/**
 * Find Physical Trending Products
 *
 * Searches the supplier's catalog for products that match
 * current Google Trends demand, ranked by opportunity score.
 *
 * Query params:
 * - supplierId: UUID of supplier to search
 * - maxResults: max products to return (default 30)
 * - minMargin: minimum margin % (default 50)
 */
import { findTrendingProducts } from '../../services/PhysicalTrendFinderService.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const { supplierId, maxResults = 30, minMargin = 50 } = request.query;

  if (!supplierId) {
    response.status(422);
    response.$body = { error: { status: 422, message: 'supplierId is required' } };
    return next();
  }

  try {
    const products = await findTrendingProducts(supplierId, {
      maxResults: parseInt(maxResults),
      minMarginPercent: parseInt(minMargin)
    });

    response.status(OK);
    response.$body = {
      data: {
        products,
        total: products.length,
        supplierId,
        fetchedAt: new Date().toISOString()
      }
    };
    next();
  } catch (error) {
    response.status(422);
    response.$body = { error: { status: 422, message: error.message } };
    next();
  }
};
