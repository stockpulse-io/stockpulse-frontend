import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import StockList from './components/StockList';
import StockDetail from './components/StockDetail';
import './App.css'; // Import the dark theme styles

function App() {
  return (
    <Router>
      <div className="app-container">
        <header className="app-header">
          <h1>StockPulse</h1>
          {/* You can add a navigation menu or user profile icon here if needed */}
        </header>
        
        <main>
          <Routes>
            {/* Route for the Dashboard / Market Watch */}
            <Route path="/" element={<StockList />} />
            
            {/* Route for the Individual Stock Details */}
            <Route path="/stock/:symbol" element={<StockDetail />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;