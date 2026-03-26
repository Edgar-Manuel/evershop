import React, { useState, useEffect } from 'react';
import { useQuery, gql } from 'urql';

const DASHBOARD_QUERY = gql`
  query DropshippingDashboard {
    dropshippingDashboard {
      activeSuppliers
      totalProducts
      digitalProducts
      last30DaysOrders
      last30DaysProfit
      last30DaysCost
    }
    dropshippingOrders(status: "pending", limit: 5) {
      id
      orderId
      status
      cost
      profit
      errorMessage
      createdAt
      supplier {
        name
        type
      }
    }
    dropshippingSuppliers {
      supplierId
      name
      type
      status
      productCount
    }
  }
`;

function StatCard({ title, value, subtitle, color = 'blue' }) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    purple: 'bg-purple-50 border-purple-200 text-purple-800'
  };
  return (
    <div className={`rounded-lg border p-5 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-75">{title}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs mt-1 opacity-60">{subtitle}</p>}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    pending: 'bg-yellow-100 text-yellow-800',
    submitted: 'bg-blue-100 text-blue-800',
    processing: 'bg-indigo-100 text-indigo-800',
    shipped: 'bg-green-100 text-green-800',
    delivered: 'bg-green-200 text-green-900',
    failed: 'bg-red-100 text-red-800',
    manual_required: 'bg-orange-100 text-orange-800'
  };
  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {status?.replace(/_/g, ' ').toUpperCase()}
    </span>
  );
}

export default function DropshippingDashboard() {
  const [{ data, fetching, error }] = useQuery({ query: DASHBOARD_QUERY });

  const handleSyncInventory = async () => {
    try {
      const res = await fetch('/api/dropshipping/sync-inventory', { method: 'POST' });
      const json = await res.json();
      alert(`Sync complete! Updated: ${json.data?.results?.updated || 0} products`);
    } catch (err) {
      alert('Sync failed: ' + err.message);
    }
  };

  if (fetching) return <div className="p-8 text-center text-gray-500">Loading dashboard...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error.message}</div>;

  const dash = data?.dropshippingDashboard || {};
  const margin = dash.last30DaysProfit && (dash.last30DaysProfit + dash.last30DaysCost)
    ? ((dash.last30DaysProfit / (dash.last30DaysProfit + dash.last30DaysCost)) * 100).toFixed(1)
    : '0';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dropshipping Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Automated dropshipping control center</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSyncInventory}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Sync Inventory
          </button>
          <a
            href="/admin/dropshipping/suppliers/new"
            className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
          >
            + Add Supplier
          </a>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Active Suppliers"
          value={dash.activeSuppliers || 0}
          color="blue"
        />
        <StatCard
          title="Total Products"
          value={dash.totalProducts || 0}
          subtitle={`${dash.digitalProducts || 0} digital`}
          color="purple"
        />
        <StatCard
          title="30-Day Profit"
          value={`$${parseFloat(dash.last30DaysProfit || 0).toFixed(2)}`}
          subtitle={`${margin}% margin`}
          color="green"
        />
        <StatCard
          title="30-Day Orders"
          value={dash.last30DaysOrders || 0}
          subtitle={`Cost: $${parseFloat(dash.last30DaysCost || 0).toFixed(2)}`}
          color="yellow"
        />
      </div>

      {/* Suppliers Status */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Suppliers</h2>
          <a href="/admin/dropshipping/suppliers" className="text-sm text-blue-600 hover:underline">
            Manage All →
          </a>
        </div>
        <div className="divide-y divide-gray-50">
          {(data?.dropshippingSuppliers || []).length === 0 && (
            <div className="px-5 py-8 text-center text-gray-400">
              <p className="font-medium">No suppliers configured</p>
              <a href="/admin/dropshipping/suppliers/new" className="text-blue-600 text-sm mt-2 block hover:underline">
                Add your first supplier →
              </a>
            </div>
          )}
          {(data?.dropshippingSuppliers || []).map((s) => (
            <div key={s.supplierId} className="px-5 py-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">{s.name}</span>
                <span className="ml-2 text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
                  {s.type}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-500">{s.productCount} products</span>
                <span
                  className={`w-2 h-2 rounded-full ${s.status ? 'bg-green-500' : 'bg-gray-300'}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Pending Orders */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-semibold text-gray-900">Orders Needing Attention</h2>
          <a href="/admin/dropshipping/orders" className="text-sm text-blue-600 hover:underline">
            View All →
          </a>
        </div>
        <div className="divide-y divide-gray-50">
          {(data?.dropshippingOrders || []).length === 0 && (
            <div className="px-5 py-8 text-center text-gray-400">
              No pending orders — everything is running smoothly!
            </div>
          )}
          {(data?.dropshippingOrders || []).map((o) => (
            <div key={o.id} className="px-5 py-3 flex items-center justify-between">
              <div>
                <span className="font-medium text-gray-900">Order #{o.orderId}</span>
                <span className="ml-2 text-sm text-gray-500">{o.supplier?.name}</span>
                {o.errorMessage && (
                  <p className="text-xs text-red-500 mt-0.5">{o.errorMessage}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-green-600 font-medium">
                  +${parseFloat(o.profit || 0).toFixed(2)}
                </span>
                <StatusBadge status={o.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: '/admin/dropshipping/wizard', label: 'Quick Wizard', icon: '✨' },
          { href: '/admin/dropshipping/import', label: 'Import Products', icon: '📦' },
          { href: '/admin/dropshipping/digital', label: 'Digital Products', icon: '💾' },
          { href: '/admin/dropshipping/pricing', label: 'Pricing Rules', icon: '💰' }
        ].map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="bg-white border border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl">{link.icon}</span>
            <p className="text-sm font-medium text-gray-700 mt-2">{link.label}</p>
          </a>
        ))}
      </div>
    </div>
  );
}

export const layout = {
  areaId: 'content',
  sortOrder: 1
};

export const query = `
  query {
    dropshippingDashboard {
      activeSuppliers
    }
  }
`;
