import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { socket } from '../socket';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

const StockDetail = () => {
  const { symbol } = useParams();
  const navigate = useNavigate();
  
  const [chartData, setChartData] = useState([]); 
  const [currentTick, setCurrentTick] = useState(null);
  const [status, setStatus] = useState("Connecting...");

  const formatPrice = (p) => {
    if (!p) return '0.00';
    const num = parseFloat(p);
    return num < 1 ? num.toFixed(6) : num.toFixed(2);
  };

  useEffect(() => {
    // Reset 
    setChartData([]);
    setCurrentTick(null);
    setStatus("Fetching History...");

    // 1. Request History (PRE-FILL THE CHART)
    socket.emit('request_history', symbol, (response) => {
      if (response.status === 'ok') {
        // Take last 50 candles and pretend they are ticks so the chart isn't empty
        const historyPoints = response.data.slice(-50).map(c => ({
          time: new Date(parseInt(c.open_time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          price: parseFloat(c.close) // Use Close price as the data point
        }));
        
        setChartData(historyPoints);
        setStatus("Waiting for Live Ticks...");
      }
    });

    // 2. Join Live Room
    socket.emit('join_stock', symbol);

    // 3. Listen for Live Ticks
    const handleTick = (newTick) => {
      setStatus("Live ⚡");
      setCurrentTick(newTick);

      setChartData((prev) => {
        const newPoint = {
          // Use the tick's actual event time
          time: new Date(parseInt(newTick.event_time)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          price: parseFloat(newTick.price)
        };

        // Keep chart flowing (Max 100 points)
        const newData = [...prev, newPoint];
        if (newData.length > 100) newData.shift();
        return newData;
      });
    };

    socket.on('tick', handleTick);

    return () => {
      socket.emit('leave_stock', symbol);
      socket.off('tick', handleTick);
    };
  }, [symbol]);

  return (
    <div className="stock-detail">
      <button onClick={() => navigate('/')} style={{ marginBottom: 20 }}>← Back</button>
      
      <div style={{ fontSize: '0.8rem', color: '#666', marginBottom: 5 }}>
        Status: <span style={{ color: status.includes('Live') ? '#00c853' : '#ff9100' }}>{status}</span>
      </div>

      <div className="stock-header">
        <h1>{symbol}</h1>
        {currentTick && (
          <div className="live-price">
             <h2>${formatPrice(currentTick.price)}</h2>
             <span style={{ color: currentTick.percent_price_change >= 0 ? '#00c853' : '#ff1744' }}>
                {parseFloat(currentTick.percent_price_change).toFixed(2)}%
             </span>
          </div>
        )}
      </div>

      <div className="chart-container" style={{ height: 500, background: '#1e1e1e', padding: 20, borderRadius: 8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
             <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2962ff" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#2962ff" stopOpacity={0}/>
                </linearGradient>
             </defs>
             <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
             
             <XAxis 
                dataKey="time" 
                stroke="#888" 
                tick={{fontSize: 10}} 
                minTickGap={40} // Prevents labels from overlapping
             />
             
             <YAxis 
                domain={['auto', 'auto']} 
                stroke="#888" 
                tickFormatter={formatPrice}
                width={80}
             />
             
             <Tooltip 
               contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }}
               formatter={(val) => [formatPrice(val), "Price"]}
             />
             
             <Area 
                type="monotone" 
                dataKey="price" 
                stroke="#2962ff" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#colorPrice)" 
                isAnimationActive={false} 
             />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StockDetail;