import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const StockDetail = ({ symbol: propSymbol, onClose }) => {
  const params = useParams();
  const routeSymbol = params?.symbol;
  const symbol = propSymbol || routeSymbol;
  const navigate = useNavigate();

  const [chartData, setChartData] = useState([]);
  const [currentTick, setCurrentTick] = useState(null);
  const [status, setStatus] = useState('Connecting...');

  const chartBufferRef = useRef([]);
  const chartRafRef = useRef(null);
  const mountedRef = useRef(true);

  const formatPrice = (p) => {
    if (p === null || p === undefined) return '0.00';
    const num = Number(p);
    return Number.isNaN(num) ? '0.00' : (num < 1 ? num.toFixed(6) : num.toFixed(2));
  };

  const flushChartBuffer = () => {
    if (!mountedRef.current) return;
    const buf = chartBufferRef.current;
    if (buf.length === 0) return;
    setChartData((prev) => {
      const combined = [...prev, ...buf];
      const start = combined.length > 100 ? combined.length - 100 : 0;
      return combined.slice(start);
    });
    chartBufferRef.current = [];
  };

  const scheduleChartFlush = () => {
    if (chartRafRef.current) return;
    chartRafRef.current = requestAnimationFrame(() => {
      chartRafRef.current = null;
      flushChartBuffer();
    });
  };

  useEffect(() => {
    if (!symbol) return;

    mountedRef.current = true;
    setChartData([]);
    setCurrentTick(null);
    setStatus('Fetching History...');

    const joinRoom = () => {
      try {
        socket.emit('join_stock', symbol);
        setStatus((s) => (s.includes('Live') ? s : 'Connected, waiting for ticks...'));
      } catch (e) {
        console.error('Error joining stock room', e);
      }
    };

    if (socket.connected) joinRoom();
    else socket.once('connect', joinRoom);

    socket.emit('request_history', symbol, (response) => {
      if (!mountedRef.current) return;
      if (response && response.status === 'ok') {
        const historyPoints = response.data.slice(-50).map((c) => ({
          time: new Date(Number(c.open_time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          price: Number(c.close)
        }));
        setChartData(historyPoints);
        setStatus('Waiting for Live Ticks...');
      } else {
        setStatus('Failed to fetch history');
      }
    });

    const handleTick = (newTick) => {
      if (!mountedRef.current) return;
      if (newTick.symbol && newTick.symbol !== symbol) return;
      setCurrentTick(newTick);
      setStatus('Live ⚡');

      chartBufferRef.current.push({
        time: new Date(Number(newTick.event_time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        price: Number(newTick.price)
      });

      scheduleChartFlush();
    };

    const onConnect = () => setStatus((s) => (s.includes('Live') ? s : 'Connected, waiting for ticks...'));
    const onDisconnect = () => setStatus('Disconnected');

    socket.on('tick', handleTick);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      mountedRef.current = false;
      try { socket.emit('leave_stock', symbol); } catch (e) {}
      socket.off('tick', handleTick);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      if (chartRafRef.current) { cancelAnimationFrame(chartRafRef.current); chartRafRef.current = null; }
      chartBufferRef.current = [];
    };
  }, [symbol]);

  const derivedStats = (() => {
    const prices = chartData.map(d => d.price).filter(p => typeof p === 'number' && !Number.isNaN(p));
    const high = prices.length ? Math.max(...prices) : null;
    const low = prices.length ? Math.min(...prices) : null;
    const points = chartData.length;
    const lastTime = chartData.length ? chartData[chartData.length - 1].time : null;
    const open1m = chartData.length ? chartData[0].price : null;
    const change1m = (currentTick && currentTick.percent_price_change !== undefined && currentTick.percent_price_change !== null)
      ? Number(currentTick.percent_price_change)
      : (open1m ? ((currentTick ? Number(currentTick.price) : (prices[prices.length-1] || 0)) - open1m) / open1m * 100 : 0);
    return { high, low, points, lastTime, open1m, change1m };
  })();

  if (!symbol) {
    return <div style={{ padding: 20 }}>No symbol selected</div>;
  }

  return (
    <div className="stock-detail">
      <div className="detail-top">
        <button className="btn ghost" onClick={() => onClose ? onClose() : navigate('/')}>← Back</button>
        <div className="detail-title">{symbol}</div>
        <div style={{ flex: 1 }} />
        <div className="muted small">Status: {status}</div>
      </div>

      <div style={{ marginTop: 12 }}>
        {currentTick && (
          <div className="live-box">
            <div className="live-price">${formatPrice(currentTick.price)}</div>
            <div className={`change ${Number(currentTick.percent_price_change) >= 0 ? 'up' : 'down'}`}>
              {Number(currentTick.percent_price_change || derivedStats.change1m).toFixed(2)}%
            </div>
            <div className="muted small">Tick: {currentTick.event_time ? new Date(Number(currentTick.event_time)).toLocaleTimeString() : '—'}</div>
          </div>
        )}
      </div>

      <div className="chart-container" style={{ height: 420, marginTop: 16 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="g1" x1="0" x2="0" y1="0" y2="1">
                <stop offset="5%" stopColor="#2962ff" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#2962ff" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false}/>
            <XAxis dataKey="time" tick={{fontSize:10}} />
            <YAxis tickFormatter={(v) => (v < 1 ? v.toFixed(6) : v.toFixed(2))} width={80} />
            <Tooltip contentStyle={{ background:'#111', border:'1px solid #222' }} formatter={(v) => [formatPrice(v),'Price']} />
            <Area dataKey="price" stroke="#2962ff" fill="url(#g1)" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display:'flex', gap:12, marginTop:16, flexWrap:'wrap' }}>
        <div className="stat-card">
          <div className="muted small">Open (first)</div>
          <div className="stat-value">${formatPrice(derivedStats.open1m)}</div>
        </div>
        <div className="stat-card">
          <div className="muted small">High</div>
          <div className="stat-value">${formatPrice(derivedStats.high)}</div>
        </div>
        <div className="stat-card">
          <div className="muted small">Low</div>
          <div className="stat-value">${formatPrice(derivedStats.low)}</div>
        </div>
        <div className="stat-card">
          <div className="muted small">Points</div>
          <div className="stat-value">{derivedStats.points}</div>
        </div>
      </div>
    </div>
  );
};

export default StockDetail;
