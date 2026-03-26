/**
 * Dropshipping Wizard
 *
 * Step 1: Choose type — Digital or Physical
 * Step 2A (Digital): Browse trending topics → AI generates and publishes eBook/audiobook
 * Step 2B (Physical): Browse trending products → Select and bulk import
 */
import React, { useState, useEffect } from 'react';

// ─── Step 1: Type Selector ───────────────────────────────────────────────────
function TypeSelector({ onSelect }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-6">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-3">
            What do you want to sell?
          </h1>
          <p className="text-purple-200 text-lg">
            Choose your dropshipping model. The system will find trending products
            and do the rest automatically.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Digital Products */}
          <button
            onClick={() => onSelect('digital')}
            className="group bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 text-left hover:bg-white/20 hover:border-purple-400 hover:scale-105 transition-all duration-200 cursor-pointer"
          >
            <div className="text-6xl mb-4">💾</div>
            <h2 className="text-2xl font-bold text-white mb-2">Digital Products</h2>
            <p className="text-purple-200 mb-4 text-sm leading-relaxed">
              eBooks, Audiobooks, Guides, Courses. Zero stock, zero shipping,
              <span className="font-semibold text-green-400"> up to 100% margin</span>.
              AI creates everything automatically.
            </p>
            <div className="space-y-1.5">
              {[
                '🤖 AI generates full eBooks & audiobooks',
                '📊 Google Trends finds hot topics',
                '✉️ Instant download delivery after purchase',
                '♾️ Infinite stock, zero fulfillment cost'
              ].map((f) => (
                <p key={f} className="text-xs text-purple-100">{f}</p>
              ))}
            </div>
            <div className="mt-5 flex items-center text-green-400 font-semibold text-sm">
              Start with Digital →
            </div>
          </button>

          {/* Physical Products */}
          <button
            onClick={() => onSelect('physical')}
            className="group bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 text-left hover:bg-white/20 hover:border-blue-400 hover:scale-105 transition-all duration-200 cursor-pointer"
          >
            <div className="text-6xl mb-4">📦</div>
            <h2 className="text-2xl font-bold text-white mb-2">Physical Products</h2>
            <p className="text-blue-200 mb-4 text-sm leading-relaxed">
              Real products from CJDropshipping. Supplier ships directly to your customer.
              <span className="font-semibold text-blue-300"> 50–200% margins</span>.
            </p>
            <div className="space-y-1.5">
              {[
                '📈 Google Trends finds what\'s selling NOW',
                '🏪 Auto-search CJDropshipping catalog',
                '🚀 1-click bulk import with all images',
                '📬 Orders auto-forwarded to supplier'
              ].map((f) => (
                <p key={f} className="text-xs text-blue-100">{f}</p>
              ))}
            </div>
            <div className="mt-5 flex items-center text-blue-400 font-semibold text-sm">
              Start with Physical →
            </div>
          </button>
        </div>

        <p className="text-center text-purple-300/60 text-xs mt-8">
          You can use both models simultaneously. Start with one, add the other later.
        </p>
      </div>
    </div>
  );
}

// ─── Step 2A: Digital Product Wizard ────────────────────────────────────────
function DigitalWizard({ onBack }) {
  const [phase, setPhase] = useState('loading'); // loading | trends | configuring | generating | done
  const [trends, setTrends] = useState([]);
  const [selectedNiche, setSelectedNiche] = useState(null);
  const [config, setConfig] = useState({
    productType: 'ebook',
    chapterCount: 7,
    targetAudience: 'beginners',
    tone: 'friendly and encouraging',
    googleTtsApiKey: ''
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [generationLog, setGenerationLog] = useState([]);

  useEffect(() => {
    fetchTrends();
  }, []);

  const fetchTrends = async () => {
    setPhase('loading');
    try {
      const res = await fetch('/api/dropshipping/wizard/trends?type=digital');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to load trends');
      setTrends(json.data.trends || []);
      setPhase('trends');
    } catch (err) {
      setError(err.message);
      setPhase('trends');
    }
  };

  const handleGenerate = async () => {
    if (!selectedNiche) return;
    setPhase('generating');
    setError(null);
    setGenerationLog([]);

    const steps = [
      'Analyzing market trends for "' + selectedNiche.category + '"...',
      'AI creating book outline and chapter structure...',
      'Writing introduction and all chapters...',
      'Generating SEO-optimized product description...',
      selectedNiche && (config.productType === 'audiobook' || config.productType === 'bundle')
        ? 'Converting to audiobook audio file...'
        : null,
      'Setting up digital download system...',
      'Publishing product to your store...'
    ].filter(Boolean);

    // Simulate progress log
    let i = 0;
    const logInterval = setInterval(() => {
      if (i < steps.length) {
        setGenerationLog((prev) => [...prev, steps[i]]);
        i++;
      } else {
        clearInterval(logInterval);
      }
    }, 3000);

    try {
      const res = await fetch('/api/dropshipping/wizard/create-digital', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: selectedNiche.searchTerms[0],
          category: selectedNiche.category,
          productType: config.productType,
          chapterCount: parseInt(config.chapterCount),
          targetAudience: config.targetAudience,
          tone: config.tone,
          googleTtsApiKey: config.googleTtsApiKey || undefined
        })
      });

      clearInterval(logInterval);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Generation failed');

      setResult(json.data);
      setPhase('done');
    } catch (err) {
      clearInterval(logInterval);
      setError(err.message);
      setPhase('configuring');
    }
  };

  if (phase === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center text-white">
          <div className="text-4xl mb-4 animate-spin">📊</div>
          <p className="text-lg font-medium">Analyzing Google Trends...</p>
          <p className="text-purple-300 text-sm mt-2">Finding the most profitable digital niches right now</p>
        </div>
      </div>
    );
  }

  if (phase === 'generating') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 p-6">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4 animate-pulse">🤖</div>
            <h2 className="text-2xl font-bold text-white">AI is creating your product...</h2>
            <p className="text-purple-300 mt-2 text-sm">
              This takes 2–5 minutes. Claude is writing a complete, sellable eBook.
            </p>
          </div>
          <div className="bg-black/40 rounded-xl p-5 space-y-3">
            {generationLog.map((log, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <span className="text-green-400">✓</span>
                <span className="text-green-300">{log}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 text-sm">
              <span className="animate-spin inline-block">⏳</span>
              <span className="text-yellow-300">
                {generationLog.length < 7 ? 'In progress...' : 'Finalizing...'}
              </span>
            </div>
          </div>
          <p className="text-center text-purple-400/60 text-xs mt-6">
            Do not close this tab
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'done' && result) {
    return (
      <div className="min-h-screen bg-slate-900 p-6 flex items-start justify-center">
        <div className="max-w-2xl w-full pt-12">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-white">{result.title}</h2>
            <p className="text-purple-300 mt-2">{result.subtitle || ''}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{result.wordCount?.toLocaleString()}</p>
              <p className="text-xs text-purple-200 mt-1">Words Generated</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-400">{result.chapterCount}</p>
              <p className="text-xs text-purple-200 mt-1">Chapters</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-yellow-400">
                ${result.estimatedMonthlyRevenue}
              </p>
              <p className="text-xs text-purple-200 mt-1">Est. Monthly Revenue</p>
            </div>
          </div>

          {/* Products created */}
          <div className="space-y-3 mb-6">
            {(result.products || []).map((p, i) => (
              <div key={i} className={`rounded-xl p-4 ${p.success ? 'bg-green-500/20 border border-green-500/40' : p.skipped ? 'bg-yellow-500/20 border border-yellow-500/40' : 'bg-red-500/20 border border-red-500/40'}`}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">
                    {p.type === 'ebook' ? '📄' : '🎧'}
                  </span>
                  <div>
                    <p className="font-medium text-white capitalize">{p.type} Product</p>
                    {p.success && <p className="text-xs text-green-300">✓ Created successfully (ID: {p.productId})</p>}
                    {p.skipped && <p className="text-xs text-yellow-300">{p.reason}</p>}
                    {p.error && <p className="text-xs text-red-300">{p.error}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Keywords */}
          {result.keywords?.length > 0 && (
            <div className="bg-white/5 rounded-xl p-4 mb-6">
              <p className="text-xs text-purple-300 mb-2">SEO Keywords targeting:</p>
              <div className="flex flex-wrap gap-2">
                {result.keywords.map((kw) => (
                  <span key={kw} className="bg-purple-500/30 text-purple-200 px-2 py-0.5 rounded text-xs">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <a
              href="/admin/dropshipping"
              className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-center font-medium hover:bg-purple-700"
            >
              View Dashboard
            </a>
            <button
              onClick={() => { setPhase('trends'); setResult(null); setSelectedNiche(null); }}
              className="flex-1 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20"
            >
              Create Another Product
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Trends view + configuration
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={onBack} className="text-purple-400 hover:text-white transition-colors">
            ← Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Digital Product Creator</h1>
            <p className="text-purple-300 text-sm">
              Select a trending niche. AI will generate and publish a complete eBook automatically.
            </p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4 mb-6 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Trending Niches Grid */}
        {!selectedNiche ? (
          <div>
            <p className="text-purple-300 text-sm mb-4">
              📊 Ranked by profitability score (Google Trends × market data)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trends.map((niche, i) => (
                <button
                  key={niche.category}
                  onClick={() => { setSelectedNiche(niche); setPhase('configuring'); }}
                  className="bg-white/10 border border-white/20 rounded-xl p-5 text-left hover:bg-white/20 hover:border-purple-400 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-3xl">{niche.icon}</span>
                    <div className="text-right">
                      {i < 3 && (
                        <span className="text-xs bg-yellow-500/30 text-yellow-300 px-2 py-0.5 rounded font-medium">
                          🔥 HOT
                        </span>
                      )}
                      {niche.isRising && (
                        <span className="ml-1 text-xs bg-green-500/30 text-green-300 px-2 py-0.5 rounded">
                          ↑ Rising
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="font-semibold text-white mb-1 text-sm">{niche.category}</h3>
                  <p className="text-purple-300 text-xs mb-3 leading-relaxed">{niche.description}</p>
                  <div className="flex justify-between text-xs">
                    <span className="text-purple-400">
                      Avg price: <span className="text-green-400 font-semibold">${niche.avgPrice}</span>
                    </span>
                    <span className="text-purple-400">
                      Score: <span className="text-white font-semibold">{niche.profitabilityScore}/100</span>
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-green-400 rounded-full"
                      style={{ width: `${niche.profitabilityScore}%` }}
                    />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Configuration Panel */
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => { setSelectedNiche(null); setPhase('trends'); }}
              className="text-purple-400 hover:text-white text-sm mb-6 block"
            >
              ← Change niche
            </button>

            <div className="bg-white/10 border border-white/20 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-4 mb-6">
                <span className="text-4xl">{selectedNiche.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedNiche.category}</h2>
                  <p className="text-purple-300 text-sm">{selectedNiche.description}</p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Product Type */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    What to create:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'ebook', label: 'eBook', icon: '📄', price: `$${(selectedNiche.avgPrice * 0.8).toFixed(2)}` },
                      { id: 'audiobook', label: 'Audiobook', icon: '🎧', price: `$${(selectedNiche.avgPrice * 1.1).toFixed(2)}` },
                      { id: 'bundle', label: 'Bundle', icon: '🎁', price: `$${(selectedNiche.avgPrice * 1.5).toFixed(2)}` }
                    ].map((pt) => (
                      <button
                        key={pt.id}
                        onClick={() => setConfig((c) => ({ ...c, productType: pt.id }))}
                        className={`p-3 rounded-xl border text-center transition-all ${
                          config.productType === pt.id
                            ? 'border-purple-400 bg-purple-500/30 text-white'
                            : 'border-white/20 text-purple-300 hover:border-white/40'
                        }`}
                      >
                        <div className="text-xl">{pt.icon}</div>
                        <div className="text-xs font-medium mt-1">{pt.label}</div>
                        <div className="text-xs text-green-400 mt-0.5">{pt.price}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chapters */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-1">
                    Chapters: <span className="text-white">{config.chapterCount}</span>
                    <span className="text-purple-400 text-xs ml-2">
                      (~{config.chapterCount * 1200} words total)
                    </span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="12"
                    value={config.chapterCount}
                    onChange={(e) => setConfig((c) => ({ ...c, chapterCount: e.target.value }))}
                    className="w-full accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-purple-400 mt-1">
                    <span>5 (quick guide)</span>
                    <span>12 (comprehensive book)</span>
                  </div>
                </div>

                {/* Target Audience */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-1">Target Audience</label>
                  <select
                    value={config.targetAudience}
                    onChange={(e) => setConfig((c) => ({ ...c, targetAudience: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="complete beginners">Complete Beginners</option>
                    <option value="beginners">Beginners</option>
                    <option value="intermediate learners">Intermediate</option>
                    <option value="professionals">Professionals</option>
                    <option value="entrepreneurs">Entrepreneurs</option>
                  </select>
                </div>

                {/* Writing Tone */}
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-1">Writing Tone</label>
                  <select
                    value={config.tone}
                    onChange={(e) => setConfig((c) => ({ ...c, tone: e.target.value }))}
                    className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="friendly and encouraging">Friendly & Encouraging</option>
                    <option value="professional and authoritative">Professional & Authoritative</option>
                    <option value="casual and conversational">Casual & Conversational</option>
                    <option value="motivational and energetic">Motivational & Energetic</option>
                    <option value="scientific and data-driven">Scientific & Data-driven</option>
                  </select>
                </div>

                {/* Google TTS Key (for audiobook) */}
                {(config.productType === 'audiobook' || config.productType === 'bundle') && (
                  <div>
                    <label className="block text-sm font-medium text-purple-200 mb-1">
                      Google TTS API Key <span className="text-purple-400">(required for audio)</span>
                    </label>
                    <input
                      type="password"
                      value={config.googleTtsApiKey}
                      onChange={(e) => setConfig((c) => ({ ...c, googleTtsApiKey: e.target.value }))}
                      placeholder="AIza..."
                      className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm placeholder-white/30"
                    />
                    <p className="text-xs text-purple-400 mt-1">
                      Get free key at console.cloud.google.com → Text-to-Speech API
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg shadow-purple-500/30"
            >
              🤖 Generate & Publish with AI
            </button>
            <p className="text-center text-purple-400/60 text-xs mt-2">
              Takes 2–5 minutes. Claude will write a complete {config.chapterCount}-chapter eBook and publish it automatically.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step 2B: Physical Product Wizard ───────────────────────────────────────
function PhysicalWizard({ onBack }) {
  const [phase, setPhase] = useState('setup'); // setup | searching | results | importing | done
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [imported, setImported] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    const res = await fetch('/api/dropshipping/suppliers');
    const json = await res.json();
    const list = (json.data?.suppliers || []).filter(
      (s) => s.status && s.type === 'cjdropshipping'
    );
    setSuppliers(list);
    if (list.length === 1) setSelectedSupplier(list[0].supplier_id);
  };

  const handleSearch = async () => {
    if (!selectedSupplier) return;
    setPhase('searching');
    setError(null);
    try {
      const res = await fetch(
        `/api/dropshipping/wizard/physical-trends?supplierId=${selectedSupplier}&maxResults=30`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Search failed');
      setProducts(json.data.products || []);
      setPhase('results');
    } catch (err) {
      setError(err.message);
      setPhase('setup');
    }
  };

  const toggleSelect = (productId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(
      new Set(products.filter((p) => !p.isAlreadyImported).map((p) => p.id))
    );
  };

  const handleImport = async () => {
    const toImport = products.filter((p) => selected.has(p.id));
    if (!toImport.length) return;
    setPhase('importing');

    try {
      const res = await fetch('/api/dropshipping/wizard/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: selectedSupplier,
          products: toImport.map((p) => ({
            supplierProductId: p.supplierProductId,
            name: p.name
          }))
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Import failed');
      setImported(json.data);
      setPhase('done');
    } catch (err) {
      setError(err.message);
      setPhase('results');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  if (phase === 'setup') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="max-w-lg w-full">
          <button onClick={onBack} className="text-blue-400 hover:text-white text-sm mb-6 block">
            ← Back
          </button>
          <h1 className="text-2xl font-bold text-white mb-2">Physical Product Finder</h1>
          <p className="text-blue-300 text-sm mb-8">
            Combines Google Trends + CJDropshipping data to find the highest-opportunity
            physical products for dropshipping right now.
          </p>

          {suppliers.length === 0 ? (
            <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-xl p-5 text-center">
              <p className="text-yellow-200 font-medium mb-3">No CJDropshipping supplier configured</p>
              <a
                href="/admin/dropshipping/suppliers/new"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                Add CJDropshipping Supplier
              </a>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-blue-200 mb-2">Select Supplier</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-4 py-3"
                >
                  <option value="">Choose supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.supplier_id} value={s.supplier_id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-3 text-red-300 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleSearch}
                disabled={!selectedSupplier}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-bold hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 transition-all"
              >
                🔍 Find Trending Products
              </button>
              <p className="text-xs text-blue-400/60 text-center">
                Searches ~15 trending categories and scores each product by demand + margin
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'searching') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center text-white">
          <div className="text-4xl mb-4 animate-bounce">🔍</div>
          <p className="text-lg font-medium">Searching trending products...</p>
          <p className="text-blue-300 text-sm mt-2">
            Checking Google Trends + CJDropshipping catalog
          </p>
        </div>
      </div>
    );
  }

  if (phase === 'importing') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center text-white">
          <div className="text-4xl mb-4 animate-spin">⚙️</div>
          <p className="text-lg font-medium">Importing {selected.size} products...</p>
          <p className="text-blue-300 text-sm mt-2">Setting up products with images and descriptions</p>
        </div>
      </div>
    );
  }

  if (phase === 'done' && imported) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 p-6">
        <div className="max-w-lg w-full text-center">
          <div className="text-5xl mb-4">🚀</div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {imported.imported} Products Imported!
          </h2>
          <p className="text-blue-300 mb-6">
            Your store now has {imported.imported} new dropshipping products. Orders will be
            automatically fulfilled via CJDropshipping.
          </p>
          <div className="flex gap-3">
            <a href="/admin/catalog/products" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700">
              View Products
            </a>
            <a href="/admin/dropshipping" className="flex-1 py-3 bg-white/10 text-white rounded-xl font-medium hover:bg-white/20">
              Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Results view
  return (
    <div className="min-h-screen bg-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <button onClick={() => setPhase('setup')} className="text-blue-400 text-sm hover:text-white block mb-1">
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-white">
              {products.length} Trending Products Found
            </h1>
            <p className="text-blue-300 text-sm">
              Ranked by Opportunity Score (trend demand × profit margin)
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={selectAll} className="px-4 py-2 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20">
              Select All ({products.filter((p) => !p.isAlreadyImported).length})
            </button>
            <button
              onClick={handleImport}
              disabled={selected.size === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
            >
              Import Selected ({selected.size})
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-xl p-4 mb-6 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {products.map((product) => {
            const isSelected = selected.has(product.id);
            return (
              <div
                key={product.id}
                onClick={() => !product.isAlreadyImported && toggleSelect(product.id)}
                className={`bg-white/10 rounded-xl overflow-hidden border transition-all cursor-pointer ${
                  product.isAlreadyImported
                    ? 'opacity-50 border-white/10 cursor-default'
                    : isSelected
                    ? 'border-blue-400 ring-2 ring-blue-400/50'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                {/* Opportunity Score Badge */}
                <div className="relative">
                  {product.image && (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="w-full h-32 object-cover"
                    />
                  )}
                  <div className="absolute top-2 right-2 bg-black/70 rounded-lg px-2 py-1">
                    <span className={`text-xs font-bold ${getScoreColor(product.opportunityScore)}`}>
                      {product.opportunityScore}
                    </span>
                  </div>
                  {isSelected && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                      <span className="text-3xl">✓</span>
                    </div>
                  )}
                  {product.isAlreadyImported && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="text-xs text-green-300 font-medium bg-black/70 px-2 py-1 rounded">
                        Already Imported
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-white text-xs font-medium line-clamp-2 mb-2">
                    {product.name}
                  </p>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Cost</span>
                    <span className="text-white">${product.cost?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-400">Sell at</span>
                    <span className="text-green-400 font-semibold">${product.suggestedPrice?.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Margin</span>
                    <span className="text-blue-400 font-semibold">{product.margin}%</span>
                  </div>
                  {product.trendScore > 0 && (
                    <div className="mt-2 h-1 bg-white/10 rounded-full">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-green-400 rounded-full"
                        style={{ width: `${product.trendScore}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Wizard Component ────────────────────────────────────────────────────
export default function DropshippingWizard() {
  const [type, setType] = useState(null); // null | 'digital' | 'physical'

  if (!type) return <TypeSelector onSelect={setType} />;
  if (type === 'digital') return <DigitalWizard onBack={() => setType(null)} />;
  if (type === 'physical') return <PhysicalWizard onBack={() => setType(null)} />;
  return null;
}

export const layout = {
  areaId: 'content',
  sortOrder: 1
};
