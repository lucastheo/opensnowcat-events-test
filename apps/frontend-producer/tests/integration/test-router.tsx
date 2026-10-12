import React from 'react';
import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '@/App';
import HomePage from '@/pages/HomePage';
import CalcPage from '@/pages/CalcPage';
import TimestampPage from '@/pages/TimestampPage';
import ExcusePage from '@/pages/ExcusePage';
import DicePage from '@/pages/DicePage';

/**
 * Renders the full React application with real router and nested routes.
 */
export function renderApp(initialPath: string = '/'): RenderResult {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<HomePage />} />
          <Route path="calc" element={<CalcPage />} />
          <Route path="timestamp" element={<TimestampPage />} />
          <Route path="excuse" element={<ExcusePage />} />
          <Route path="dice" element={<DicePage />} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}
