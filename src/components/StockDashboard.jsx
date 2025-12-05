import React, { useEffect, useRef, useState } from 'react';
import { socket } from '../socket';
import StockDetail from './StockDetail';

/**
 * StockDashboard (self-contained)
 * - includes createWatchlist and addToWatchlist helpers
 * - optimized live updates with RAF batching
 * - Watchlist UI uses classes targeted by App.css tweaks
 */

export default function StockDashboard() {
  const [query, setQuery] = useState('');
  const [stocks, setStocks] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  // Collections persisted to localStorage
  const [favorites, setFavorites] = useState(() => JSON.parse(localStorage.getItem('favorites') || '[]'));
  const [pinned, setPinned] = useState(() => JSON.parse(localStorage.getItem('pinned') || '[]'));
  const [watchlists, setWatchlists] = useState(() => JSON.parse(localStorage.getItem('watchlists') || '[]'));

  // Refs for live updates
  const stocksRef = useRef(new Map());
  const rafRef = useRef(null);
  const lastRenderRef = useRef(0);

  // --- Live socket + initial snapshot ---
  useEffect(() => {
    let mounted = true;

    const joinMarket = () => socket.emit('join_market_watch');
    if (socket.connected) joinMarket();
    else socket.once('connect', joinMarket);

    socket.emit('request_market_data', (response) => {
      if (!mounted) return;
      if (response.status === 'ok') {
        response.data.forEach(s => {
          const price = Number(s.price) || 0;
          const open1m = Number(s.open1m) || 0;
          const change = open1m > 0 ? ((price - open1m) / open1m) * 100 : (Number(s.change) || 0);
          stocksRef.current.set(s.symbol, { ...s, price, open1m, change });
        });
        setStocks(Array.from(stocksRef.current.values()));
      }
    });

    const scheduleRender = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const now = performance.now();
        if (now - lastRenderRef.current < 40) return;
        lastRenderRef.current = now;
        setStocks(Array.from(stocksRef.current.values()));
      });
    };

    const handleMarketUpdate = (updates) => {
      updates.forEach(u => {
        const symbol = u.symbol;
        const price = Number(u.price) || 0;
        const existing = stocksRef.current.get(symbol);
        let change;
        if (u.percent_price_change !== undefined && u.percent_price_change !== null) change = Number(u.percent_price_change);
        if (existing) {
          const open1m = Number(existing.open1m) || 0;
          if (change === undefined) change = open1m > 0 ? ((price - open1m) / open1m) * 100 : existing.change || 0;
          stocksRef.current.set(symbol, { ...existing, price, change, lastEventTime: u.event_time });
        } else {
          const open1m = Number(u.open1m) || 0;
          if (change === undefined) change = open1m > 0 ? ((price - open1m) / open1m) * 100 : 0;
          stocksRef.current.set(symbol, { symbol, price, open1m, change, lastEventTime: u.event_time });
        }
      });
      scheduleRender();
    };

    socket.on('market_update', handleMarketUpdate);

    return () => {
      mounted = false;
      socket.emit('leave_market_watch');
      socket.off('market_update', handleMarketUpdate);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      socket.off('connect');
    };
  }, []);

  // Persist collections
  useEffect(() => localStorage.setItem('favorites', JSON.stringify(favorites)), [favorites]);
  useEffect(() => localStorage.setItem('pinned', JSON.stringify(pinned)), [pinned]);
  useEffect(() => localStorage.setItem('watchlists', JSON.stringify(watchlists)), [watchlists]);

  // --- Search / filter ---
  useEffect(() => {
    const q = query.trim().toLowerCase();
    if (!q) setFiltered(stocks.slice(0, 200));
    else setFiltered(stocks.filter(s => (s.symbol || '').toLowerCase().includes(q) || (s.name || '').toLowerCase().includes(q)));
  }, [query, stocks]);

  // Keyboard shortcuts to open search
  useEffect(() => {
    const handler = (e) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      if ((isMac && e.metaKey && e.key.toLowerCase() === 'k') || (!isMac && e.ctrlKey && e.key.toLowerCase() === 'k')) {
        e.preventDefault(); setShowSearch(true);
      }
      if (e.key === '/') {
        const t = e.target; if (t && ['INPUT','TEXTAREA'].includes(t.tagName)) return;
        e.preventDefault(); setShowSearch(true);
      }
      if (e.key === 'Escape') setShowSearch(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // --- Collection helpers (ensure createWatchlist exists) ---
  const toggleFavorite = (symbol) => setFavorites(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [symbol, ...prev]);
  const togglePinned = (symbol) => setPinned(prev => prev.includes(symbol) ? prev.filter(s => s !== symbol) : [symbol, ...prev]);

  // create a new watchlist (persisted)
  const createWatchlist = (name) => {
    if (!name || !name.trim()) return;
    const wl = { id: Date.now(), name: name.trim(), symbols: [] };
    setWatchlists(prev => [wl, ...prev]);
  };

  // add a symbol to a watchlist by id
  const addToWatchlist = (watchlistId, symbol) => {
    setWatchlists(prev => prev.map(w => {
      if (w.id !== watchlistId) return w;
      const existing = new Set(w.symbols || []);
      existing.add(symbol);
      return { ...w, symbols: Array.from(existing) };
    }));
  };

  const openDetail = (sym) => setSelected(sym);
  const closeDetail = () => setSelected(null);

  return (
    <div className="dashboard-root">
      <header className="header">
        <div className="header-left">
          <div className="brand">StockPulse</div>
        </div>

        <div className="header-center">
          <input
            className="search-input"
            placeholder="Search symbols or companies (Ctrl/Cmd+K)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setShowSearch(true)}
          />
        </div>

        <div className="header-right">
          <button className="btn ghost" onClick={() => setShowSearch(true)}>🔎</button>
          <button className="btn" onClick={() => alert('Sign in not implemented')}>Sign in</button>
        </div>
      </header>

      <div className="layout">
        <aside className="sidebar">
          <div className="panel">
            <h3>Watchlist</h3>
            <div className="muted">Live</div>

            <div className="chip-row" style={{marginTop:8}}>
              <button className="chip" onClick={() => setSelected(null)}>All</button>
              <button className="chip" onClick={() => setSelected(favorites[0] || null)}>Favorites</button>
            </div>

            <div style={{marginTop:8}}>
              <div className="muted">Pinned</div>
              <div className="pinned-list">
                {pinned.length === 0
                  ? <div className="muted">No pinned symbols</div>
                  : pinned.map(sym => (
                      <div key={sym} className="pinned-item" onClick={() => openDetail(sym)}>
                        <div className="symbol">{sym}</div>
                        <div className="price">${Number((stocksRef.current.get(sym) || {}).price || 0).toFixed(2)}</div>
                      </div>
                    ))
                }
              </div>
            </div>

            <div className="watchlists-block">
              <div className="muted">Watchlists</div>
              <div className="muted small">{watchlists.length === 0 ? 'No watchlists' : `${watchlists.length} watchlist(s)`}</div>

              <div className="wl-create">
                <input id="new-wl" placeholder="New watchlist name" />
                <button className="create-wl" onClick={() => {
                  const el = document.getElementById('new-wl');
                  if (el && el.value.trim()) { createWatchlist(el.value.trim()); el.value = ''; }
                }}>Create</button>
              </div>
            </div>

            <div className="tip">Tip: Press <span className="kbd">Ctrl/Cmd + K</span> to open search</div>
          </div>
        </aside>

        <main className="main">
          {!selected ? (
            <>
              <div className="panel">
                <h2>Market Overview</h2>
                <div className="muted">Live prices and charts</div>
              </div>

              <div className="panel list-panel">
                { (filtered.length === 0) ? <div className="muted">No symbols found</div> : filtered.map(s => (
                  <div key={s.symbol} className="list-item" onClick={() => openDetail(s.symbol)}>
                    <div className="list-left">
                      <div className="symbol">{s.symbol}</div>
                      <div className="muted small">{s.name || ''}</div>
                    </div>
                    <div className="list-right">
                      <div className={`change ${Number(s.change) >= 0 ? 'up' : 'down'}`}>{Number(s.change || 0).toFixed(2)}%</div>
                      <div className="price">${Number(s.price || 0).toFixed(2)}</div>
                      <div className="row-actions">
                        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); toggleFavorite(s.symbol); }}>{favorites.includes(s.symbol) ? '★' : '☆'}</button>
                        <button className="icon-btn" onClick={(e) => { e.stopPropagation(); togglePinned(s.symbol); }}>{pinned.includes(s.symbol) ? '📌' : '📍'}</button>
                      </div>
                    </div>
                  </div>
                )) }
              </div>
            </>
          ) : (
            <div className="panel">
              <div className="detail-toolbar">
                <button className="btn ghost" onClick={closeDetail}>← Back</button>
                <div style={{ flex: 1 }} />
                <div className="muted">Viewing: {selected}</div>
              </div>

              <StockDetail symbol={selected} onClose={closeDetail} />
            </div>
          )}
        </main>
      </div>

      {/* Search overlay */}
      {showSearch && (
        <div className="search-overlay" onClick={() => setShowSearch(false)}>
          <div className="search-box" onClick={(e) => e.stopPropagation()}>
            <div className="search-header" style={{display:'flex', gap:8}}>
              <input autoFocus value={query} onChange={(e)=> setQuery(e.target.value)} placeholder="Search symbols, companies..." className="search-large" />
              <button className="btn ghost" onClick={() => setShowSearch(false)}>Close</button>
            </div>

            <div className="search-results">
              {filtered.slice(0, 50).map(s => (
                <div key={s.symbol} className="search-row" onClick={() => { setSelected(s.symbol); setShowSearch(false); }}>
                  <div>
                    <div className="symbol">{s.symbol}</div>
                    <div className="muted small">{s.name || ''}</div>
                  </div>
                  <div className="text-right">
                    <div className={`change ${Number(s.change) >= 0 ? 'up' : 'down'}`}>{Number(s.change || 0).toFixed(2)}%</div>
                    <div className="muted small">${Number(s.price || 0).toFixed(2)}</div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && <div className="muted p-3">No results</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
