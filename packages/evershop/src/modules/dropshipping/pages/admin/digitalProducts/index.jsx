import React, { useState } from 'react';
import { useQuery, gql } from 'urql';

const DIGITAL_QUERY = gql`
  query {
    dropshippingDigitalProducts {
      id
      productId
      fileName
      fileUrl
      downloadLimit
      expiryDays
      licenseType
      deliveryMethod
    }
  }
`;

export default function DigitalProducts() {
  const [{ data, fetching }, reexecute] = useQuery({ query: DIGITAL_QUERY });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    fileUrl: '',
    fileName: '',
    downloadLimit: 5,
    expiryDays: 30,
    licenseType: 'single'
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/dropshipping/digital-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to create product');
      setMessage({ type: 'success', text: `Product "${form.name}" created at $${form.price}` });
      setShowForm(false);
      setForm({ name: '', description: '', price: '', fileUrl: '', fileName: '', downloadLimit: 5, expiryDays: 30, licenseType: 'single' });
      reexecute({ requestPolicy: 'network-only' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const products = data?.dropshippingDigitalProducts || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Digital Products</h1>
          <p className="text-sm text-gray-500 mt-1">
            Zero-cost delivery. Instant access. Up to 1000% margins.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700"
        >
          + Add Digital Product
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-6">
        <h3 className="font-semibold text-purple-900 mb-1">💡 Most Profitable Strategy</h3>
        <p className="text-sm text-purple-700">
          Digital products have no shipping cost and instant delivery. Source PLR eBooks for $1–5 and sell at $9.99–$49.99.
          Software license keys can be sourced in bulk and resold at 500%+ margins.
        </p>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'error' ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
          {message.text}
        </div>
      )}

      {/* Products Grid */}
      {products.length === 0 && !fetching ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="text-5xl mb-4">💾</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">No digital products yet</h2>
          <p className="text-gray-400 mb-2">eBooks, software, courses, license keys — all delivered automatically</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700"
          >
            Add Your First Digital Product
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="text-2xl">
                  {p.deliveryMethod === 'license' ? '🔑' : p.deliveryMethod === 'url' ? '🔗' : '📄'}
                </div>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">
                  {p.licenseType}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{p.fileName || 'Digital Product'}</h3>
              <div className="text-xs text-gray-500 space-y-1">
                <p>Downloads: {p.downloadLimit}</p>
                <p>Expires: {p.expiryDays} days after purchase</p>
                <p>Delivery: {p.deliveryMethod}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Product Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4 max-h-screen overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">Add Digital Product</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Complete SEO Guide 2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price ($) *</label>
                <input type="number" required min="0.01" step="0.01" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="9.99"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">File/Product Name</label>
                <input type="text" value={form.fileName} onChange={(e) => setForm((f) => ({ ...f, fileName: e.target.value }))}
                  placeholder="guide.pdf"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Download URL (or file path)</label>
              <input type="text" value={form.fileUrl} onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
                placeholder="https://... or /path/to/file.pdf"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Download Limit</label>
                <input type="number" min="1" value={form.downloadLimit} onChange={(e) => setForm((f) => ({ ...f, downloadLimit: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expiry (days)</label>
                <input type="number" min="1" value={form.expiryDays} onChange={(e) => setForm((f) => ({ ...f, expiryDays: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">License Type</label>
                <select value={form.licenseType} onChange={(e) => setForm((f) => ({ ...f, licenseType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="single">Single</option>
                  <option value="multiple">Multiple</option>
                  <option value="unlimited">Unlimited</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export const layout = {
  areaId: 'content',
  sortOrder: 1
};
