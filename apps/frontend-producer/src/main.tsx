import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { initSnowcatTracker } from '@/tracker/snowcat';
import App from '@/App';
import HomePage from '@/pages/HomePage';
import CalcPage from '@/pages/CalcPage';
import TimestampPage from '@/pages/TimestampPage';
import ExcusePage from '@/pages/ExcusePage';
import DicePage from '@/pages/DicePage';
import './styles.css';

// Initialize OpenSnowcat tracker on client startup
initSnowcatTracker();

const rootElement = document.getElementById('root');

if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />}>
            <Route index element={<HomePage />} />
            <Route path="calc" element={<CalcPage />} />
            <Route path="timestamp" element={<TimestampPage />} />
            <Route path="excuse" element={<ExcusePage />} />
            <Route path="dice" element={<DicePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </React.StrictMode>
  );
}
