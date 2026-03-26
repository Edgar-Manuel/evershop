import React, { useState, useEffect } from 'react';
import { useQuery, gql } from 'urql';

const SUPPLIERS_QUERY = gql`
  query {
    dropshippingSuppliers {
      supplierId
      name
      type
      status
    }
  }
`;

export default function ImportProducts() {
  const [{ data }] = useQuery({ query: SUPPLIERS_QUERY });
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [keyword, setKeyword] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(null);
  const [imported, setImported] = useState(new Set());
  const [message, setMessage] = useState(null);

  const suppliers = (data?.dropshippingSuppliers || []).filter((s) => s.status);

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!selectedSupplier || !keyword) return;
    setSearching(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/dropshipping/suppliers/${selectedSupplier}/search?keyword=${encodeURIComponent(keyword)}&pageSize=24`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Search failed');
      setSearchResults(json.data?.products || []);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async (product) => {
    setImporting(product.id);
    setMessage(null);
    try {
      const res = await fetch('/api/dropshipping/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier,
          supplierProductId: String(product.id),
          markupType: 'percentage',
          markupValue: 80
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Import failed');
      setImported((prev) => new Set([...prev, product.id]));
      setMessage({
        type: 'success',
        text: `"${json.data?.name}" imported! Selling at $${json.data?.sellingPrice?.toFixed(2)} (cost: $${json.data?.cost?.toFixed(2)})`
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin/dropshipping" className="text-gray-400 hover:text-gray-600">
          ← Dashboard
        </a>
        <h1 className="text-2xl font-bold text-gray-900">Import Products</h1>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <div className="flex gap-3">
          <select
            value={selectedSupplier}
            onChange={(e) => setSelectedSupplier(e.target.value)}
            required
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select Supplier</option>
            {suppliers.map((s) => (
              <option key={s.supplierId} value={s.supplierId}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Search products... (e.g. wireless earbuds, phone case)"
            required
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={searching}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Tip: Search for trending products with high demand and low competition
        </p>
      </form>

      {/* Message */}
      {message && (
        <div
          className={`mb-4 px-4 py-3 rounded-lg text-sm ${
            message.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Results Grid */}
      {searchResults.length > 0 && (
        <div>
          <p className="text-sm text-gray-500 mb-4">{searchResults.length} products found</p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {searchResults.map((product) => {
              const isImported = imported.has(product.id);
              const isImporting = importing === product.id;
              return (
                <div key={product.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-40 object-cover"
                    />
                  )}
                  <div className="p-3">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-2">
                      {product.name}
                    </p>
                    <div className="flex justify-between text-xs text-gray-500 mb-3">
                      <span>Cost: <strong>${parseFloat(product.cost || 0).toFixed(2)}</strong></span>
                      <span>Sell: <strong className="text-green-600">${parseFloat(product.suggestedPrice || 0).toFixed(2)}</strong></span>
                    </div>
                    {product.rating && (
                      <p className="text-xs text-gray-400 mb-2">
                        ⭐ {product.rating} · {product.soldCount} sold
                      </p>
                    )}
                    <button
                      onClick={() => handleImport(product)}
                      disabled={isImported || isImporting}
                      className={`w-full py-2 rounded-lg text-xs font-medium transition-all ${
                        isImported
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : isImporting
                          ? 'bg-gray-100 text-gray-400 cursor-wait'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isImported ? '✓ Imported' : isImporting ? 'Importing...' : 'Import Product'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {searchResults.length === 0 && !searching && keyword && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          No products found. Try different keywords.
        </div>
      )}
    </div>
  );
}

export const layout = {
  areaId: 'content',
  sortOrder: 1
};
