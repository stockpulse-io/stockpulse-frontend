import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { socket } from '../socket'; // Import singleton

const StockList = () => {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Request data via socket
    socket.emit('request_market_data', (response) => {
      if (response.status === 'ok') {
        setStocks(response.data);
      } else {
        console.error("Error fetching stocks:", response.message);
      }
      setLoading(false);
    });

    // Clean up: (Optional) remove listeners if any specific ones were added
    return () => {
       // If you added socket.on('market_update') listeners, remove them here
    };
  }, []);

  if (loading) return <div>Loading Markets...</div>;

  return (
    <div className="stock-list">
      <h2>Market Watch</h2>
      <div className="list-header">
        <span>Symbol</span>
        <span>Price</span>
        <span>1m Change</span> {/* Updated Label */}
      </div>
      {stocks.map((stock) => (
        <Link to={`/stock/${stock.symbol}`} key={stock.symbol} className="stock-item-link">
          <div className="stock-item">
            <span className="symbol">{stock.symbol}</span>
            <span className="price">${parseFloat(stock.price).toFixed(4)}</span>
            <span className={`change ${stock.change >= 0 ? 'green' : 'red'}`}>
              {parseFloat(stock.change).toFixed(2)}%
            </span>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default StockList;