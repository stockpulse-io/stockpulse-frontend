import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Create the root element
const root = ReactDOM.createRoot(document.getElementById('root'));

// Render the App component
// StrictMode is enabled to highlight potential problems in the application
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);