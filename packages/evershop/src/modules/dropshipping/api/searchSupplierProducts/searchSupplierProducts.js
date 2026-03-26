import { select } from '@evershop/postgres-query-builder';
import { pool } from '../../../lib/postgres/connection.js';
import CJDropshipping from '../../dropshipping/services/CJDropshippingService.js';
import AliExpress from '../../dropshipping/services/AliExpressService.js';
import { calculatePrice } from '../../dropshipping/services/PricingRuleService.js';
import { OK } from '../../../lib/util/httpStatus.js';

export default async (request, response, next) => {
  const supplierId = request.params.id;
  const { keyword, page = 1, pageSize = 20 } = request.query;

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
    let products = [];

    if (supplier.type === 'cjdropshipping') {
      const raw = await CJDropshipping.searchProducts({
        keyword,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        apiKey: supplier.api_key,
        apiPassword: config.api_password || supplier.api_secret
      });

      const list = raw?.list || raw?.productList || (Array.isArray(raw) ? raw : []);

      products = await Promise.all(
        list.map(async (p) => {
          const cost = parseFloat(p.sellPrice || p.productPrice || 0);
          const suggestedPrice = await calculatePrice(cost, supplierId);
          return {
            id: p.pid || p.productId,
            name: p.productNameEn || p.entryNameEn,
            image: p.productImage || p.mainImage,
            cost,
            suggestedPrice,
            inventory: p.productInventory || 'Unknown',
            category: p.categoryName || '',
            rating: p.score || 0,
            soldCount: p.sellCount || 0
          };
        })
      );
    } else if (supplier.type === 'aliexpress') {
      const raw = await AliExpress.searchProducts({
        keyword,
        page: parseInt(page),
        pageSize: parseInt(pageSize),
        appKey: supplier.api_key,
        appSecret: supplier.api_secret,
        trackingId: config.tracking_id || 'default'
      });

      products = await Promise.all(
        raw.map(async (p) => {
          const cost = parseFloat(p.target_app_sale_price || p.sale_price || 0);
          const suggestedPrice = await calculatePrice(cost, supplierId);
          return {
            id: p.product_id,
            name: p.product_title,
            image: p.product_main_image_url,
            cost,
            suggestedPrice,
            affiliateUrl: p.promotion_link,
            commission: p.commission_rate,
            rating: p.evaluate_rate,
            soldCount: p.lastest_volume
          };
        })
      );
    }

    response.status(OK);
    response.$body = { data: { products, total: products.length } };
    next();
  } catch (error) {
    response.status(422);
    response.$body = { error: { status: 422, message: error.message } };
    next();
  }
};
