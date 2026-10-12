import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  eventEmitter,
  type EventMode
} from '@/tracker/event-emitter';

const getTitleForRoute = (pathname: string): string => {
  switch (pathname) {
    case '/calc':
      return 'Simple Calculator';
    case '/timestamp':
      return 'Location Timestamp';
    case '/excuse':
      return 'Daily Standup Excuse';
    case '/dice':
      return 'Dice Emulator';
    case '/':
    default:
      return 'Service Dashboard';
  }
};

export const App: React.FC = () => {
  const location = useLocation();
  const [eventCount, setEventCount] = useState<number>(() => eventEmitter.getEventCount());
  const [mode, setMode] = useState<EventMode>(() => eventEmitter.getEventMode());

  // Subscribe to global event counter and mode updates
  useEffect(() => {
    const unsubCount = eventEmitter.subscribeEventCount((count) => {
      setEventCount(count);
    });
    const unsubMode = eventEmitter.subscribeEventMode((newMode) => {
      setMode(newMode);
    });
    return () => {
      unsubCount();
      unsubMode();
    };
  }, []);

  // Track page view on route change
  useEffect(() => {
    const pageTitle = getTitleForRoute(location.pathname);
    if (typeof document !== 'undefined') {
      document.title = `${pageTitle} | OpenSnowcat Test`;
    }

    eventEmitter.emitPageView({
      title: pageTitle
    }).catch((err) => {
      console.warn('[App] PageView tracking failed:', err);
    });
  }, [location.pathname]);

  const handleModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMode = e.target.value as EventMode;
    eventEmitter.setEventMode(newMode);
  };

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-inner">
          <div className="brand-section">
            <NavLink to="/" className="brand-title">
              OpenSnowcat Test
            </NavLink>
            <span className="brand-badge">Frontend Producer</span>
          </div>

          <nav>
            <ul className="nav-links">
              <li>
                <NavLink
                  id="link-nav-home"
                  data-testid="link-nav-home"
                  to="/"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                  end
                >
                  Home
                </NavLink>
              </li>
              <li>
                <NavLink
                  id="link-nav-calc"
                  data-testid="link-nav-calc"
                  to="/calc"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Calculator
                </NavLink>
              </li>
              <li>
                <NavLink
                  id="link-nav-timestamp"
                  data-testid="link-nav-timestamp"
                  to="/timestamp"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Timestamp
                </NavLink>
              </li>
              <li>
                <NavLink
                  id="link-nav-excuse"
                  data-testid="link-nav-excuse"
                  to="/excuse"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Excuse
                </NavLink>
              </li>
              <li>
                <NavLink
                  id="link-nav-dice"
                  data-testid="link-nav-dice"
                  to="/dice"
                  className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                >
                  Dice
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="header-controls">
            <div className="control-group">
              <label htmlFor="event-mode-select">Mode:</label>
              <select
                id="event-mode-select"
                data-testid="event-mode-select"
                className="mode-select"
                value={mode}
                onChange={handleModeChange}
              >
                <option value="both">Both (No-Schema &amp; Self-Describing)</option>
                <option value="no_schema_only">No-Schema Only</option>
                <option value="self_describing_only">Self-Describing Only</option>
              </select>
            </div>

            <div className="control-group">
              <span>Events:</span>
              <span
                id="frontend-events-counter"
                data-testid="frontend-events-counter"
                className="events-counter-badge"
              >
                {eventCount}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default App;
