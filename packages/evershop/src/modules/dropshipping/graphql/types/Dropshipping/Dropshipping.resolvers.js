import { select } from '@evershop/postgres-query-builder';
import { pool } from '../../../../../lib/postgres/connection.js';
import camelCase from 'camelcase-keys';

export default {
  Query: {
    dropshippingSuppliers: async (_, __, { user }) => {
      if (!user) return null;
      const rows = await select('supplier_id, name, type, api_endpoint, status, created_at, updated_at')
        .from('dropshipping_supplier')
        .orderBy('created_at', 'DESC')
        .execute(pool);
      return rows.map(camelCase);
    },

    dropshippingSupplier: async (_, { supplierId }, { user }) => {
      if (!user) return null;
      const rows = await select('supplier_id, name, type, api_endpoint, status, created_at, updated_at')
        .from('dropshipping_supplier')
        .where('supplier_id', '=', supplierId)
        .execute(pool);
      return rows.length ? camelCase(rows[0]) : null;
    },

    dropshippingOrders: async (_, { status, limit = 20, offset = 0 }, { user }) => {
      if (!user) return null;
      let query = select('*').from('dropshipping_order');
      if (status) query.where('status', '=', status);
      query.orderBy('created_at', 'DESC').limit(limit).offset(offset);
      const rows = await query.execute(pool);
      return rows.map(camelCase);
    },

    dropshippingDashboard: async (_, __, { user }) => {
      if (!user) return null;

      const [supplierCount, productCount, digitalCount, recentStats] = await Promise.all([
        select('COUNT(*) as count').from('dropshipping_supplier').where('status', '=', true).execute(pool),
        select('COUNT(*) as count').from('dropshipping_product').execute(pool),
        select('COUNT(*) as count').from('dropshipping_product').where('is_digital', '=', true).execute(pool),
        select('SUM(profit) as profit, SUM(cost) as cost, COUNT(*) as orders')
          .from('dropshipping_order')
          .where('created_at', '>=', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .execute(pool)
      ]);

      return {
        activeSuppliers: parseInt(supplierCount[0]?.count || 0),
        totalProducts: parseInt(productCount[0]?.count || 0),
        digitalProducts: parseInt(digitalCount[0]?.count || 0),
        last30DaysOrders: parseInt(recentStats[0]?.orders || 0),
        last30DaysProfit: parseFloat(recentStats[0]?.profit || 0),
        last30DaysCost: parseFloat(recentStats[0]?.cost || 0)
      };
    },

    dropshippingPricingRules: async (_, { supplierId }, { user }) => {
      if (!user) return null;
      let query = select('*').from('dropshipping_pricing_rule').orderBy('priority', 'DESC');
      if (supplierId) query.where('supplier_id', '=', supplierId);
      const rows = await query.execute(pool);
      return rows.map(camelCase);
    },

    dropshippingDigitalProducts: async (_, __, { user }) => {
      if (!user) return null;
      const rows = await select('*').from('dropshipping_digital_product').execute(pool);
      return rows.map(camelCase);
    },

    dropshippingAnalytics: async (_, { days = 30 }, { user }) => {
      if (!user) return null;
      const since = new Date();
      since.setDate(since.getDate() - days);
      const rows = await select('*')
        .from('dropshipping_analytics')
        .where('date', '>=', since.toISOString().substring(0, 10))
        .orderBy('date', 'DESC')
        .execute(pool);
      return rows.map(camelCase);
    }
  },

  DropshippingOrder: {
    supplier: async (dsOrder) => {
      if (!dsOrder.supplierId) return null;
      const rows = await select('supplier_id, name, type, status')
        .from('dropshipping_supplier')
        .where('supplier_id', '=', dsOrder.supplierId)
        .execute(pool);
      return rows.length ? camelCase(rows[0]) : null;
    }
  },

  DropshippingSupplier: {
    productCount: async (supplier) => {
      const rows = await select('COUNT(*) as count')
        .from('dropshipping_product')
        .where('supplier_id', '=', supplier.supplierId)
        .execute(pool);
      return parseInt(rows[0]?.count || 0);
    }
  },

  Order: {
    dropshippingOrders: async (order) => {
      const rows = await select('*')
        .from('dropshipping_order')
        .where('order_id', '=', order.orderId || order.order_id)
        .execute(pool);
      return rows.map(camelCase);
    }
  }
};
