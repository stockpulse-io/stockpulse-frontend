import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { socket } from '../socket';

const StockList = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const stocksRef = useRef(new Map()); // symbol -> stock object
  const rafIdRef = useRef(null);
  const lastRenderRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    // join market room after connect
    const joinMarket = () => socket.emit('join_market_watch');
    if (socket.connected) joinMarket();
    else socket.once('connect', joinMarket);

    // initial snapshot (contains open1m)
    socket.emit('request_market_data', (response) => {
      if (!mounted) return;
      if (response.status === 'ok') {
        response.data.forEach(s => {
          // Normalise numeric fields and ensure open1m exists
          const price = Number(s.price) || 0;
          const open1m = Number(s.open1m) || 0;
          const change = open1m > 0 ? ((price - open1m) / open1m) * 100 : (Number(s.change) || 0);
          stocksRef.current.set(s.symbol, { ...s, price, open1m, change });
        });
        // initial render
        setStocks(Array.from(stocksRef.current.values()));
      } else {
        console.error('Error fetching stocks:', response.message);
      }
      setLoading(false);
    });

    // batch-render function using requestAnimationFrame
    const scheduleRender = () => {
      if (rafIdRef.current) return;
      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        // throttle to ~25 FPS by default
        const now = performance.now();
        if (now - lastRenderRef.current < 40) {
          return;
        }
        lastRenderRef.current = now;
        setStocks(Array.from(stocksRef.current.values()));
      });
    };

    // handle market updates (server emits aggregated updates)
    const handleMarketUpdate = (updates) => {
      updates.forEach(u => {
        const symbol = u.symbol;
        const price = Number(u.price) || 0;
        const existing = stocksRef.current.get(symbol);

        // Prefer percent_price_change if provided by tick
        let change = undefined;
        if (u.percent_price_change !== undefined && u.percent_price_change !== null) {
          change = Number(u.percent_price_change);
        }

        if (existing) {
          const open1m = Number(existing.open1m) || 0;
          if (change === undefined) {
            change = open1m > 0 ? ((price - open1m) / open1m) * 100 : existing.change || 0;
          }
          stocksRef.current.set(symbol, { ...existing, price, change, lastEventTime: u.event_time || existing.lastEventTime });
        } else {
          // fallback - symbol not in initial snapshot
          const open1m = Number(u.open1m) || 0;
          if (change === undefined) {
            change = open1m > 0 ? ((price - open1m) / open1m) * 100 : 0;
          }
          stocksRef.current.set(symbol, { symbol, price, open1m, change, lastEventTime: u.event_time });
        }
      });

      // schedule UI render (batched)
      scheduleRender();
    };

    socket.on('market_update', handleMarketUpdate);

    return () => {
      mounted = false;
      socket.emit('leave_market_watch');
      socket.off('market_update', handleMarketUpdate);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      socket.off('connect'); // remove once handler if present
    };
  }, []);

  if (loading) return <div>Loading Markets...</div>;

  return (
    <div className="stock-list">
      <h2>Market Watch</h2>
      <div className="list-header">
        <span>Symbol</span>
        <span>Price</span>
        <span>1m Change</span>
      </div>
      {stocks.map((stock) => (
        <Link to={`/stock/${stock.symbol}`} key={stock.symbol} className="stock-item-link">
          <div className="stock-item">
            <span className="symbol">{stock.symbol}</span>
            <span className="price">${Number(stock.price).toFixed(4)}</span>
            <span className={`change ${Number(stock.change) >= 0 ? 'green' : 'red'}`}>
              {Number(stock.change).toFixed(2)}%
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default StockList;
