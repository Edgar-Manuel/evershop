import { select } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  try {
    // Supplier count
    const supplierCount = await select('COUNT(*) as count')
      .from('dropshipping_supplier')
      .where('status', '=', true)
      .execute(pool);

    // Product count
    const productCount = await select('COUNT(*) as count')
      .from('dropshipping_product')
      .execute(pool);

    // Digital product count
    const digitalCount = await select('COUNT(*) as count')
      .from('dropshipping_product')
      .where('is_digital', '=', true)
      .execute(pool);

    // Dropshipping orders stats
    const orderStats = await select(
      'status, COUNT(*) as count, SUM(profit) as total_profit, SUM(cost) as total_cost'
    )
      .from('dropshipping_order')
      .groupBy('status')
      .execute(pool);

    // Total revenue from dropshipping (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentProfit = await select('SUM(profit) as total_profit, SUM(cost) as total_cost, COUNT(*) as orders')
      .from('dropshipping_order')
      .where('created_at', '>=', thirtyDaysAgo.toISOString())
      .execute(pool);

    // Recent pending orders needing attention
    const pendingOrders = await select('do.*, o.order_number, ds.name as supplier_name')
      .from('dropshipping_order do')
      .leftJoin('"order" o')
      .on('do.order_id', '=', 'o.order_id')
      .leftJoin('dropshipping_supplier ds')
      .on('do.supplier_id', '=', 'ds.supplier_id')
      .where('do.status', 'IN', ['pending', 'failed', 'manual_required'])
      .orderBy('do.created_at', 'DESC')
      .limit(10)
      .execute(pool);

    // Daily profit trend (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const profitTrend = await select(
      "DATE(created_at) as date, SUM(profit) as profit, COUNT(*) as orders"
    )
      .from('dropshipping_order')
      .where('created_at', '>=', sevenDaysAgo.toISOString())
      .groupBy('DATE(created_at)')
      .orderBy('DATE(created_at)', 'ASC')
      .execute(pool);

    response.status(OK);
    response.$body = {
      data: {
        summary: {
          activeSuppliers: parseInt(supplierCount[0]?.count || 0),
          totalProducts: parseInt(productCount[0]?.count || 0),
          digitalProducts: parseInt(digitalCount[0]?.count || 0),
          last30Days: {
            orders: parseInt(recentProfit[0]?.orders || 0),
            totalCost: parseFloat(recentProfit[0]?.total_cost || 0).toFixed(2),
            totalProfit: parseFloat(recentProfit[0]?.total_profit || 0).toFixed(2)
          }
        },
        ordersByStatus: orderStats.map((s) => ({
          status: s.status,
          count: parseInt(s.count),
          totalProfit: parseFloat(s.total_profit || 0).toFixed(2),
          totalCost: parseFloat(s.total_cost || 0).toFixed(2)
        })),
        pendingOrders,
        profitTrend: profitTrend.map((d) => ({
          date: d.date,
          profit: parseFloat(d.profit || 0).toFixed(2),
          orders: parseInt(d.orders)
        }))
      }
    };
    next();
  } catch (error) {
    response.status(500);
    response.$body = { error: { status: 500, message: error.message } };
    next();
  }
};
