/**
 * Discover Trends API
 *
 * Returns trending opportunities for both digital and physical products.
 * Uses Google Trends (no API key required) + static niche data.
 *
 * Query params:
 * - type: 'digital' | 'physical'
 */
import { getDigitalTrends, getPhysicalTrends } from '../../services/TrendDiscoveryService.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const type = request.query.type || 'digital';

  try {
    let trends;
    if (type === 'physical') {
      trends = await getPhysicalTrends();
    } else {
      trends = await getDigitalTrends();
    }

    response.status(OK);
    response.$body = {
      data: {
        type,
        trends,
        fetchedAt: new Date().toISOString()
      }
    };
    next();
  } catch (error) {
    response.status(500);
    response.$body = { error: { status: 500, message: error.message } };
    next();
  }
};
