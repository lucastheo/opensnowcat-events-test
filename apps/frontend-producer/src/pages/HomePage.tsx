import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  eventEmitter,
  type EventMode
} from '@/tracker/event-emitter';

export const HomePage: React.FC = () => {
  const [eventCount, setEventCount] = useState<number>(() => eventEmitter.getEventCount());
  const [mode, setMode] = useState<EventMode>(() => eventEmitter.getEventMode());

  useEffect(() => {
    const unsubCount = eventEmitter.subscribeEventCount(setEventCount);
    const unsubMode = eventEmitter.subscribeEventMode(setMode);
    return () => {
      unsubCount();
      unsubMode();
    };
  }, []);

  const services = [
    {
      title: 'Simple Calculator',
      path: '/calc',
      id: 'link-nav-calc',
      description: 'Perform arithmetic operations (+, -, *, /) processed strictly on the backend API.',
      endpoint: 'POST /api/calc',
      actionName: 'Open Calculator'
    },
    {
      title: 'Location Timestamp',
      path: '/timestamp',
      id: 'link-nav-timestamp',
      description: 'Fetch the current time formatted for your detected or chosen timezone via the backend.',
      endpoint: 'POST /api/timestamp',
      actionName: 'Open Timestamp'
    },
    {
      title: 'Daily Standup Excuse',
      path: '/excuse',
      id: 'link-nav-excuse',
      description: 'Generate humorous, developer-centric excuses for skipping daily standups from the backend.',
      endpoint: 'GET /api/daily-excuse',
      actionName: 'Open Excuse Generator'
    },
    {
      title: 'Dice Emulator',
      path: '/dice',
      id: 'link-nav-dice',
      description: 'Roll dice of various polyhedral sides (d4 to d100) computed by the backend service.',
      endpoint: 'POST /api/dice',
      actionName: 'Open Dice Roller'
    }
  ];

  return (
    <div className="home-page">
      <div className="page-header">
        <h1 className="page-title">Service Dashboard</h1>
        <p className="page-subtitle">
          Interactive frontend test producer delegating all business logic to the backend and tracking events with OpenSnowcat.
        </p>
      </div>

      <div className="card-grid">
        {services.map((svc) => (
          <div key={svc.path} className="card">
            <h2 className="card-title">{svc.title}</h2>
            <p className="card-desc">{svc.description}</p>
            <div style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#64748b' }}>
              <strong>Endpoint:</strong> <code>{svc.endpoint}</code>
            </div>
            <Link
              to={svc.path}
              id={svc.id}
              data-testid={svc.id}
              className="card-btn"
            >
              {svc.actionName} &rarr;
            </Link>
          </div>
        ))}
      </div>

      <div className="stats-panel">
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Live Session Statistics</h2>
        <div className="stats-grid">
          <div className="stat-item">
            <div className="stat-label">Events Dispatched</div>
            <div className="stat-value">{eventCount}</div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Active Emission Mode</div>
            <div className="stat-value" style={{ fontSize: '1.1rem', textTransform: 'capitalize' }}>
              {mode.replace(/_/g, ' ')}
            </div>
          </div>
          <div className="stat-item">
            <div className="stat-label">Available Services</div>
            <div className="stat-value">4</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
