import { execute } from '@evershop/postgres-query-builder';

export default async (connection) => {
  // Dropshipping suppliers table
  await execute(
    connection,
    `CREATE TABLE IF NOT EXISTS dropshipping_supplier (
      supplier_id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(50) NOT NULL DEFAULT 'custom',
      api_key TEXT,
      api_secret TEXT,
      api_endpoint TEXT,
      status BOOLEAN DEFAULT true,
      config JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Mapping between EverShop products and supplier products
  await execute(
    connection,
    `CREATE TABLE IF NOT EXISTS dropshipping_product (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      product_id INTEGER REFERENCES product(product_id) ON DELETE CASCADE,
      supplier_id UUID REFERENCES dropshipping_supplier(supplier_id) ON DELETE CASCADE,
      supplier_product_id VARCHAR(255) NOT NULL,
      supplier_variant_id VARCHAR(255),
      supplier_sku VARCHAR(255),
      supplier_cost DECIMAL(12,4) NOT NULL DEFAULT 0,
      markup_type VARCHAR(20) DEFAULT 'percentage',
      markup_value DECIMAL(12,4) DEFAULT 30,
      auto_price_sync BOOLEAN DEFAULT true,
      auto_stock_sync BOOLEAN DEFAULT true,
      is_digital BOOLEAN DEFAULT false,
      supplier_data JSONB DEFAULT '{}',
      last_synced_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await execute(
    connection,
    `CREATE INDEX IF NOT EXISTS dropshipping_product_product_id_idx ON dropshipping_product(product_id)`
  );

  await execute(
    connection,
    `CREATE INDEX IF NOT EXISTS dropshipping_product_supplier_id_idx ON dropshipping_product(supplier_id)`
  );

  // Auto-fulfillment order tracking
  await execute(
    connection,
    `CREATE TABLE IF NOT EXISTS dropshipping_order (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      order_id INTEGER REFERENCES "order"(order_id) ON DELETE CASCADE,
      supplier_id UUID REFERENCES dropshipping_supplier(supplier_id),
      supplier_order_id VARCHAR(255),
      status VARCHAR(50) DEFAULT 'pending',
      tracking_number VARCHAR(255),
      carrier VARCHAR(100),
      cost DECIMAL(12,4) DEFAULT 0,
      profit DECIMAL(12,4) DEFAULT 0,
      error_message TEXT,
      supplier_response JSONB DEFAULT '{}',
      submitted_at TIMESTAMP,
      shipped_at TIMESTAMP,
      delivered_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await execute(
    connection,
    `CREATE INDEX IF NOT EXISTS dropshipping_order_order_id_idx ON dropshipping_order(order_id)`
  );

  // Dynamic pricing rules (cost-based markup tiers)
  await execute(
    connection,
    `CREATE TABLE IF NOT EXISTS dropshipping_pricing_rule (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      supplier_id UUID REFERENCES dropshipping_supplier(supplier_id) ON DELETE CASCADE,
      cost_from DECIMAL(12,4),
      cost_to DECIMAL(12,4),
      markup_type VARCHAR(20) DEFAULT 'percentage',
      markup_value DECIMAL(12,4) DEFAULT 30,
      min_profit DECIMAL(12,4) DEFAULT 0,
      round_to DECIMAL(12,4) DEFAULT 0.99,
      priority INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Digital products: files, licenses, download tokens
  await execute(
    connection,
    `CREATE TABLE IF NOT EXISTS dropshipping_digital_product (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      product_id INTEGER REFERENCES product(product_id) ON DELETE CASCADE,
      file_name VARCHAR(255),
      file_path TEXT,
      file_url TEXT,
      file_size BIGINT DEFAULT 0,
      download_limit INTEGER DEFAULT 5,
      expiry_days INTEGER DEFAULT 30,
      license_type VARCHAR(50) DEFAULT 'single',
      delivery_method VARCHAR(50) DEFAULT 'download',
      delivery_data JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  // Download tokens issued per order
  await execute(
    connection,
    `CREATE TABLE IF NOT EXISTS dropshipping_digital_download (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      order_id INTEGER REFERENCES "order"(order_id) ON DELETE CASCADE,
      customer_id INTEGER REFERENCES customer(customer_id) ON DELETE SET NULL,
      digital_product_id UUID REFERENCES dropshipping_digital_product(id) ON DELETE CASCADE,
      download_token VARCHAR(255) UNIQUE NOT NULL,
      download_count INTEGER DEFAULT 0,
      max_downloads INTEGER DEFAULT 5,
      expires_at TIMESTAMP,
      last_downloaded_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`
  );

  await execute(
    connection,
    `CREATE INDEX IF NOT EXISTS dropshipping_digital_download_token_idx ON dropshipping_digital_download(download_token)`
  );

  await execute(
    connection,
    `CREATE INDEX IF NOT EXISTS dropshipping_digital_download_order_idx ON dropshipping_digital_download(order_id)`
  );

  // Product import queue from suppliers
  await execute(
    connection,
    `CREATE TABLE IF NOT EXISTS dropshipping_import_queue (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      supplier_id UUID REFERENCES dropshipping_supplier(supplier_id) ON DELETE CASCADE,
      supplier_product_id VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'pending',
      data JSONB DEFAULT '{}',
      error TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      processed_at TIMESTAMP
    )`
  );

  // Profit analytics snapshots (daily)
  await execute(
    connection,
    `CREATE TABLE IF NOT EXISTS dropshipping_analytics (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      date DATE NOT NULL,
      supplier_id UUID REFERENCES dropshipping_supplier(supplier_id) ON DELETE CASCADE,
      orders_count INTEGER DEFAULT 0,
      revenue DECIMAL(12,4) DEFAULT 0,
      cost DECIMAL(12,4) DEFAULT 0,
      profit DECIMAL(12,4) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(date, supplier_id)
    )`
  );
};
