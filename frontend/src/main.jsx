import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-left" toastOptions={{
        duration: 3000,
        style: { fontFamily: 'Cairo', direction: 'rtl', borderRadius: '12px' },
        success: { iconTheme: { primary: '#10B981', secondary: '#fff' } },
        error: { iconTheme: { primary: '#EF4444', secondary: '#fff' } },
      }} />
    </BrowserRouter>
  </React.StrictMode>
);
