#!/usr/bin/env node
/**
 * Local OpenSnowcat Stream Collector Emulator (Port 8080)
 *
 * Implements the Snowplow / OpenSnowcat Collector HTTP protocol:
 * - POST /com.snowplowanalytics.snowplow/tp2 (JSON payload batching)
 * - GET  /i (Pixel tracker query parameters)
 * - GET  /health (Collector health check)
 * - GET  /stats (Inspect received event IDs and counts vs Simple Collector)
 * - POST /reset (Clear in-memory events)
 */
import http from 'node:http';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 1024 * 1024;

const ROUTES = {
  HEALTH: '/health',
  ROOT: '/',
  STATS: '/stats',
  RESET: '/reset',
  TP2: '/com.snowplowanalytics.snowplow/tp2',
  PIXEL: '/i',
};

const APP_IDS = {
  FRONTEND: 'frontend-producer',
  BACKEND: 'backend-producer',
};

const receivedEvents = [];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Origin, X-Requested-With');
}

const server = http.createServer((req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  // 1. Healthcheck endpoint
  if (req.method === 'GET' && (url.pathname === ROUTES.HEALTH || url.pathname === ROUTES.ROOT)) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'opensnowcat-collector', port: PORT }));
    return;
  }

  // 2. Stats & Inspection endpoint
  if (req.method === 'GET' && url.pathname === ROUTES.STATS) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        total_received: receivedEvents.length,
        frontend_events: receivedEvents.filter((e) => e.aid === APP_IDS.FRONTEND).length,
        backend_events: receivedEvents.filter((e) => e.aid === APP_IDS.BACKEND).length,
        events: receivedEvents,
      })
    );
    return;
  }

  // 3. Reset endpoint
  if (req.method === 'POST' && url.pathname === ROUTES.RESET) {
    receivedEvents.length = 0;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'reset', total_received: 0 }));
    return;
  }

  // 4. OpenSnowcat / Snowplow POST collector endpoint (/com.snowplowanalytics.snowplow/tp2)
  if (req.method === 'POST' && url.pathname === ROUTES.TP2) {
    let body = '';
    let bodyBytes = 0;
    let aborted = false;

    req.on('data', (chunk) => {
      if (aborted) return;
      bodyBytes += chunk.length;
      if (bodyBytes > MAX_BODY_BYTES) {
        aborted = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Payload too large' }));
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (aborted) return;
      try {
        const parsed = JSON.parse(body);
        const rows = Array.isArray(parsed?.data) ? parsed.data : [];
        for (const item of rows) {
          if (!item || typeof item !== 'object') continue;
          const entry = {
            eid: item.eid || null,
            e: item.e || null,
            aid: item.aid || null,
            dtm: item.dtm || null,
            ttm: item.ttm || null,
            received_at: new Date().toISOString(),
          };
          receivedEvents.push(entry);
          console.log(
            `[OpenSnowcat :${PORT}] event received | eid=${entry.eid} | app=${entry.aid} | type=${entry.e}`
          );
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid collector payload' }));
      }
    });
    return;
  }

  // 5. OpenSnowcat / Snowplow GET pixel endpoint (/i)
  if (req.method === 'GET' && url.pathname === ROUTES.PIXEL) {
    const entry = {
      eid: url.searchParams.get('eid'),
      e: url.searchParams.get('e'),
      aid: url.searchParams.get('aid'),
      dtm: url.searchParams.get('dtm'),
      ttm: url.searchParams.get('ttm'),
      received_at: new Date().toISOString(),
    };
    receivedEvents.push(entry);
    console.log(
      `[OpenSnowcat :${PORT}] pixel event | eid=${entry.eid} | app=${entry.aid} | type=${entry.e}`
    );
    res.writeHead(200, { 'Content-Type': 'image/gif' });
    res.end(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: `Not found: ${req.method} ${url.pathname}` }));
});

server.listen(PORT, HOST, () => {
  console.log(`[OpenSnowcat Collector] Listening on http://${HOST}:${PORT}`);
  console.log(`  POST http://localhost:${PORT}/com.snowplowanalytics.snowplow/tp2`);
  console.log(`  GET  http://localhost:${PORT}/health`);
  console.log(`  GET  http://localhost:${PORT}/stats`);
});
