import React, { useState } from 'react';
import { useQuery, gql } from 'urql';

const SUPPLIERS_QUERY = gql`
  query {
    dropshippingSuppliers {
      supplierId
      name
      type
      status
      productCount
      createdAt
    }
  }
`;

const TYPE_LABELS = {
  cjdropshipping: { label: 'CJDropshipping', color: 'bg-blue-100 text-blue-800' },
  aliexpress: { label: 'AliExpress', color: 'bg-orange-100 text-orange-800' },
  custom: { label: 'Custom', color: 'bg-gray-100 text-gray-700' },
  digital: { label: 'Digital', color: 'bg-purple-100 text-purple-800' }
};

export default function SupplierGrid() {
  const [{ data, fetching, error }, reexecute] = useQuery({ query: SUPPLIERS_QUERY });
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (supplierId, name) => {
    if (!confirm(`Delete supplier "${name}"? This will also remove all linked product mappings.`)) return;
    setDeleting(supplierId);
    try {
      const res = await fetch(`/api/dropshipping/suppliers/${supplierId}`, { method: 'DELETE' });
      if (res.ok) {
        reexecute({ requestPolicy: 'network-only' });
      } else {
        alert('Failed to delete supplier');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setDeleting(null);
    }
  };

  const handleToggle = async (supplierId, currentStatus) => {
    await fetch(`/api/dropshipping/suppliers/${supplierId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: !currentStatus })
    });
    reexecute({ requestPolicy: 'network-only' });
  };

  if (fetching) return <div className="p-8 text-center text-gray-400">Loading suppliers...</div>;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
        <a
          href="/admin/dropshipping/suppliers/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Add Supplier
        </a>
      </div>

      {(data?.dropshippingSuppliers || []).length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">🏪</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No suppliers yet</h2>
          <p className="text-gray-400 mb-6">
            Connect CJDropshipping, AliExpress, or add a custom supplier to start
            automating your dropshipping orders.
          </p>
          <a
            href="/admin/dropshipping/suppliers/new"
            className="inline-block px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Add Your First Supplier
          </a>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Name</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Type</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Products</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(data?.dropshippingSuppliers || []).map((s) => {
                const typeInfo = TYPE_LABELS[s.type] || TYPE_LABELS.custom;
                return (
                  <tr key={s.supplierId} className="hover:bg-gray-50">
                    <td className="px-5 py-4 font-medium text-gray-900">{s.name}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{s.productCount || 0}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => handleToggle(s.supplierId, s.status)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          s.status
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {s.status ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <a
                          href={`/admin/dropshipping/import?supplier=${s.supplierId}`}
                          className="text-blue-600 hover:underline"
                        >
                          Import Products
                        </a>
                        <button
                          onClick={() => handleDelete(s.supplierId, s.name)}
                          disabled={deleting === s.supplierId}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const layout = {
  areaId: 'content',
  sortOrder: 1
};
