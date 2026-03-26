import React, { useState } from 'react';

const SUPPLIER_TYPES = [
  {
    id: 'cjdropshipping',
    name: 'CJDropshipping',
    description: 'Best for physical products. Free API, auto-fulfillment, US/CN warehouses.',
    fields: ['apiKey', 'apiPassword'],
    icon: '📦'
  },
  {
    id: 'aliexpress',
    name: 'AliExpress Affiliate',
    description: 'Massive catalog. Commission-based model. Manual order placement.',
    fields: ['apiKey', 'apiSecret', 'trackingId'],
    icon: '🛍️'
  },
  {
    id: 'digital',
    name: 'Digital Products',
    description: 'eBooks, software, courses. Zero fulfillment cost, instant delivery.',
    fields: [],
    icon: '💾'
  },
  {
    id: 'custom',
    name: 'Custom Supplier',
    description: 'Any other supplier. Configure manually via API endpoint.',
    fields: ['apiEndpoint', 'apiKey', 'apiSecret'],
    icon: '⚙️'
  }
];

export default function SupplierNew() {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState(null);
  const [form, setForm] = useState({ name: '', apiKey: '', apiSecret: '', apiPassword: '', trackingId: '', apiEndpoint: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleTypeSelect = (type) => {
    setSelectedType(type);
    setForm((f) => ({ ...f, name: type.name }));
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const config = {};
    if (form.apiPassword) config.api_password = form.apiPassword;
    if (form.trackingId) config.tracking_id = form.trackingId;

    try {
      const res = await fetch('/api/dropshipping/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          type: selectedType.id,
          apiKey: form.apiKey || undefined,
          apiSecret: form.apiSecret || undefined,
          apiEndpoint: form.apiEndpoint || undefined,
          config: Object.keys(config).length ? config : undefined
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to add supplier');

      window.location.href = `/admin/dropshipping/suppliers`;
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <a href="/admin/dropshipping/suppliers" className="text-gray-400 hover:text-gray-600">
          ← Suppliers
        </a>
        <h1 className="text-2xl font-bold text-gray-900">Add New Supplier</h1>
      </div>

      {/* Step 1: Select Type */}
      {step === 1 && (
        <div>
          <p className="text-gray-600 mb-6">
            Choose your supplier type. Each type has different integration capabilities.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {SUPPLIER_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => handleTypeSelect(type)}
                className="text-left bg-white border-2 border-gray-200 rounded-xl p-5 hover:border-blue-400 hover:shadow-md transition-all"
              >
                <div className="text-3xl mb-3">{type.icon}</div>
                <h3 className="font-bold text-gray-900 mb-1">{type.name}</h3>
                <p className="text-sm text-gray-500">{type.description}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && selectedType && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl">{selectedType.icon}</span>
            <div>
              <h2 className="font-bold text-gray-900">{selectedType.name}</h2>
              <p className="text-sm text-gray-500">{selectedType.description}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Supplier Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {selectedType.fields.includes('apiKey') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key / Email
              </label>
              <input
                type="text"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={selectedType.id === 'cjdropshipping' ? 'Your CJ account email' : 'API Key'}
              />
            </div>
          )}

          {selectedType.fields.includes('apiPassword') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Password
              </label>
              <input
                type="password"
                value={form.apiPassword}
                onChange={(e) => setForm((f) => ({ ...f, apiPassword: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">
                Get your CJ API credentials at{' '}
                <span className="font-mono">developers.cjdropshipping.com</span>
              </p>
            </div>
          )}

          {selectedType.fields.includes('apiSecret') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">API Secret</label>
              <input
                type="password"
                value={form.apiSecret}
                onChange={(e) => setForm((f) => ({ ...f, apiSecret: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}

          {selectedType.fields.includes('trackingId') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Affiliate Tracking ID
              </label>
              <input
                type="text"
                value={form.trackingId}
                onChange={(e) => setForm((f) => ({ ...f, trackingId: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          )}

          {selectedType.fields.includes('apiEndpoint') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Endpoint URL
              </label>
              <input
                type="url"
                value={form.apiEndpoint}
                onChange={(e) => setForm((f) => ({ ...f, apiEndpoint: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                placeholder="https://api.yoursupplier.com"
              />
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add Supplier'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export const layout = {
  areaId: 'content',
  sortOrder: 1
};
