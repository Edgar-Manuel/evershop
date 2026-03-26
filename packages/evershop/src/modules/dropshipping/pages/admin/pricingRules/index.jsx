import React, { useState } from 'react';
import { useQuery, gql } from 'urql';

const PRICING_QUERY = gql`
  query {
    dropshippingPricingRules {
      id
      name
      costFrom
      costTo
      markupType
      markupValue
      minProfit
      roundTo
      priority
      isActive
    }
    dropshippingSuppliers {
      supplierId
      name
    }
  }
`;

const DEFAULT_TIERS = [
  { name: '$0–$5 (200% markup)', costFrom: 0, costTo: 5, markupValue: 200, note: 'Budget products → sell at 3x cost' },
  { name: '$5–$20 (150% markup)', costFrom: 5, costTo: 20, markupValue: 150, note: 'Mid-range products' },
  { name: '$20–$50 (80% markup)', costFrom: 20, costTo: 50, markupValue: 80, note: 'Higher-value items' },
  { name: '$50+ (50% markup)', costFrom: 50, costTo: null, markupValue: 50, note: 'Premium products' }
];

export default function PricingRules() {
  const [{ data, fetching }, reexecute] = useQuery({ query: PRICING_QUERY });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    supplierId: '',
    costFrom: 0,
    costTo: '',
    markupType: 'percentage',
    markupValue: 80,
    minProfit: 0,
    roundTo: 0.99,
    priority: 0
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/dropshipping/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          supplierId: form.supplierId || undefined,
          costTo: form.costTo !== '' ? parseFloat(form.costTo) : null
        })
      });
      if (!res.ok) throw new Error('Failed to save rule');
      setShowForm(false);
      setForm({ name: '', supplierId: '', costFrom: 0, costTo: '', markupType: 'percentage', markupValue: 80, minProfit: 0, roundTo: 0.99, priority: 0 });
      reexecute({ requestPolicy: 'network-only' });
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const applyDefaultTiers = async () => {
    if (!confirm('Apply default profit-maximizing tiers? This will add 4 pricing rules.')) return;
    for (const tier of DEFAULT_TIERS) {
      await fetch('/api/dropshipping/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tier.name,
          costFrom: tier.costFrom,
          costTo: tier.costTo,
          markupType: 'percentage',
          markupValue: tier.markupValue,
          roundTo: 0.99,
          priority: 100 - tier.costFrom
        })
      });
    }
    reexecute({ requestPolicy: 'network-only' });
  };

  const rules = data?.dropshippingPricingRules || [];
  const suppliers = data?.dropshippingSuppliers || [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pricing Rules</h1>
          <p className="text-sm text-gray-500 mt-1">
            Automatically set selling prices based on supplier cost
          </p>
        </div>
        <div className="flex gap-2">
          {rules.length === 0 && (
            <button
              onClick={applyDefaultTiers}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
            >
              Apply Smart Defaults
            </button>
          )}
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add Rule
          </button>
        </div>
      </div>

      {/* Default Tiers Info */}
      {rules.length === 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-blue-900 mb-2">Recommended Pricing Strategy</h3>
          <div className="space-y-2">
            {DEFAULT_TIERS.map((t) => (
              <div key={t.name} className="flex justify-between text-sm text-blue-800">
                <span>{t.note}</span>
                <span className="font-mono font-bold">+{t.markupValue}%</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-blue-600 mt-3">
            All prices round to .99 (e.g., $14.99, $49.99) for psychological pricing
          </p>
        </div>
      )}

      {/* Rules Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
        {rules.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-4xl mb-3">💰</p>
            <p className="font-medium">No pricing rules configured</p>
            <p className="text-sm mt-1">Click "Apply Smart Defaults" to get started with optimal pricing</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Rule Name</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Cost Range</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Markup</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Min Profit</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Round To</th>
                <th className="px-5 py-3 text-left font-semibold text-gray-600">Priority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rules.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium text-gray-900">{r.name}</td>
                  <td className="px-5 py-3 text-gray-600 font-mono text-xs">
                    ${r.costFrom} – {r.costTo ? `$${r.costTo}` : '∞'}
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-semibold text-green-700">
                      {r.markupType === 'percentage' ? `+${r.markupValue}%` : `+$${r.markupValue}`}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-gray-600">${r.minProfit || 0}</td>
                  <td className="px-5 py-3 text-gray-600">.{String(r.roundTo || 0.99).split('.')[1] || '99'}</td>
                  <td className="px-5 py-3 text-gray-500">{r.priority}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Rule Form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <form onSubmit={handleSave} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Add Pricing Rule</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rule Name *</label>
              <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost From ($)</label>
                <input type="number" step="0.01" min="0" value={form.costFrom} onChange={(e) => setForm((f) => ({ ...f, costFrom: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cost To ($, blank = unlimited)</label>
                <input type="number" step="0.01" min="0" value={form.costTo} onChange={(e) => setForm((f) => ({ ...f, costTo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="∞" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Markup Type</label>
                <select value={form.markupType} onChange={(e) => setForm((f) => ({ ...f, markupType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount ($)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Markup Value {form.markupType === 'percentage' ? '(%)' : '($)'}
                </label>
                <input type="number" step="0.01" min="0" required value={form.markupValue} onChange={(e) => setForm((f) => ({ ...f, markupValue: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Profit ($)</label>
                <input type="number" step="0.01" min="0" value={form.minProfit} onChange={(e) => setForm((f) => ({ ...f, minProfit: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Round To (.XX)</label>
                <input type="number" step="0.01" min="0" max="0.99" value={form.roundTo} onChange={(e) => setForm((f) => ({ ...f, roundTo: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Rule'}
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
