import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { Runner } from '../../src/runner.js';
import { Logger } from '../../src/utils/logger.js';

describe('Test Bot End-to-End Integration Tests', { timeout: 30000 }, () => {
  let backendServer: http.Server;
  let frontendServer: http.Server;
  let backendUrl: string;
  let frontendUrl: string;

  const hitCounts = {
    calc: 0,
    timestamp: 0,
    excuse: 0,
    dice: 0,
  };

  const resetHitCounts = () => {
    hitCounts.calc = 0;
    hitCounts.timestamp = 0;
    hitCounts.excuse = 0;
    hitCounts.dice = 0;
  };

  beforeAll(async () => {
    // 1. Setup Mock Backend Server
    backendServer = http.createServer((req, res) => {
      // CORS headers for browser requests from mock frontend
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

      if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
      }

      const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

      if (req.method === 'POST' && url.pathname === '/api/calc') {
        hitCounts.calc++;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ result: 16 }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/timestamp') {
        hitCounts.timestamp++;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            timestamp_iso: '2026-10-12T12:00:00.000Z',
            formatted_local: '12/10/2026',
            timezone: 'UTC',
          })
        );
        return;
      }

      if (req.method === 'GET' && url.pathname === '/api/daily-excuse') {
        hitCounts.excuse++;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ id: 1, excuse: 'Test excuse' }));
        return;
      }

      if (req.method === 'POST' && url.pathname === '/api/dice') {
        hitCounts.dice++;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ rolls: [3, 4], total: 7 }));
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Not found: ${req.method} ${url.pathname}` }));
    });

    await new Promise<void>((resolve) => {
      backendServer.listen(0, '127.0.0.1', () => resolve());
    });
    const backendAddress = backendServer.address() as AddressInfo;
    backendUrl = `http://127.0.0.1:${backendAddress.port}`;

    // 2. Setup Mock Frontend Server with all required DOM element IDs
    const frontendHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Mock Frontend Producer</title>
  <style>
    body { font-family: sans-serif; margin: 20px; }
    nav a { margin-right: 12px; }
    .view { margin-top: 20px; }
    .result-box { min-height: 20px; margin-top: 10px; }
  </style>
</head>
<body>
  <nav>
    <a id="link-nav-home" href="/">Home</a>
    <a id="header-nav-calc" href="/calc">Calc</a>
    <a id="header-nav-timestamp" href="/timestamp">Timestamp</a>
    <a id="header-nav-excuse" href="/excuse">Excuse</a>
    <a id="header-nav-dice" href="/dice">Dice</a>
  </nav>

  <div id="view-home" class="view">
    <h1>Home Page</h1>
    <a id="link-nav-calc" href="/calc">Open Calculator</a>
    <a id="link-nav-timestamp" href="/timestamp">Open Timestamp</a>
    <a id="link-nav-excuse" href="/excuse">Open Excuse</a>
    <a id="link-nav-dice" href="/dice">Open Dice</a>
  </div>

  <div id="view-calc" class="view" style="display: none;">
    <h1>Calculator</h1>
    <input id="calc-input-a" type="number" value="12" />
    <input id="calc-input-b" type="number" value="4" />
    <button id="btn-calc-submit">Calculate</button>
    <div id="calc-result" class="result-box"></div>
  </div>

  <div id="view-timestamp" class="view" style="display: none;">
    <h1>Timestamp</h1>
    <button id="btn-timestamp-fetch">Get Location Timestamp</button>
    <div id="timestamp-result" class="result-box"></div>
  </div>

  <div id="view-excuse" class="view" style="display: none;">
    <h1>Daily Standup Excuse</h1>
    <button id="btn-generate-excuse">Get Daily Excuse</button>
    <div id="excuse-result" class="result-box"></div>
  </div>

  <div id="view-dice" class="view" style="display: none;">
    <h1>Dice Emulator</h1>
    <button id="btn-roll-dice">Roll Dice</button>
    <div id="dice-result" class="result-box"></div>
  </div>

  <script>
    function renderRoute(path) {
      document.querySelectorAll('.view').forEach(function(el) {
        el.style.display = 'none';
      });
      if (path === '/calc') {
        document.getElementById('view-calc').style.display = 'block';
      } else if (path === '/timestamp') {
        document.getElementById('view-timestamp').style.display = 'block';
      } else if (path === '/excuse') {
        document.getElementById('view-excuse').style.display = 'block';
      } else if (path === '/dice') {
        document.getElementById('view-dice').style.display = 'block';
      } else {
        document.getElementById('view-home').style.display = 'block';
      }
    }

    renderRoute(window.location.pathname);

    document.querySelectorAll('nav a, #view-home a').forEach(function(a) {
      a.addEventListener('click', function(e) {
        e.preventDefault();
        var href = a.getAttribute('href');
        window.history.pushState(null, '', href);
        renderRoute(href);
      });
    });

    document.getElementById('btn-calc-submit').addEventListener('click', function() {
      var a = Number(document.getElementById('calc-input-a').value) || 0;
      var b = Number(document.getElementById('calc-input-b').value) || 0;
      fetch('http://localhost:4000/api/calc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ a: a, b: b, operator: '+' })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        document.getElementById('calc-result').textContent = String(data.result);
      })
      .catch(function(err) {
        document.getElementById('calc-result').textContent = 'Error: ' + err.message;
      });
    });

    document.getElementById('btn-timestamp-fetch').addEventListener('click', function() {
      fetch('http://localhost:4000/api/timestamp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timezone: 'UTC' })
      })
      .then(function(res) { return res.json(); })
      .then(function(data) {
        document.getElementById('timestamp-result').textContent = data.formatted_local;
      })
      .catch(function(err) {
        document.getElementById('timestamp-result').textContent = 'Error: ' + err.message;
      });
    });

    document.getElementById('btn-generate-excuse').addEventListener('click', function() {
      fetch('http://localhost:4000/api/daily-excuse')
      .then(function(res) { return res.json(); })
      .then(function(data) {
        document.getElementById('excuse-result').textContent = data.excuse;
      })
      .catch(function(err) {
        document.getElementById('excuse-result').textContent = 'Error: ' + err.message;
      });
    });

    document.getElementById('btn-roll-dice').addEventListener('click', function() {
      fetch('http://localhost:4000/api/dice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 2, sides: 'd6' })
      })
      .then(function(res) { return res.json(); })
      .then(data => {
        document.getElementById('dice-result').textContent = 'Total: ' + data.total;
      })
      .catch(function(err) {
        document.getElementById('dice-result').textContent = 'Error: ' + err.message;
      });
    });
  </script>
</body>
</html>`;

    frontendServer = http.createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(frontendHtml);
    });

    await new Promise<void>((resolve) => {
      frontendServer.listen(0, '127.0.0.1', () => resolve());
    });
    const frontendAddress = frontendServer.address() as AddressInfo;
    frontendUrl = `http://127.0.0.1:${frontendAddress.port}`;
  });

  afterAll(async () => {
    // Teardown: ensure all mock servers and sockets are cleanly closed
    if (backendServer) {
      backendServer.closeAllConnections?.();
      await new Promise<void>((resolve) => backendServer.close(() => resolve()));
    }
    if (frontendServer) {
      frontendServer.closeAllConnections?.();
      await new Promise<void>((resolve) => frontendServer.close(() => resolve()));
    }
  });

  beforeEach(() => {
    resetHitCounts();
  });

  it('1. should execute Runner in "backend" mode with 100% success rate and record latency and hit counts', async () => {
    const logger = new Logger({ silent: true });
    const iterations = 3;

    const runner = new Runner({
      targetUrls: {
        frontendUrl,
        backendUrl,
      },
      mode: 'backend',
      iterations,
      concurrency: 1,
      delayMs: 0,
      logger,
    });

    const summary = await runner.start();

    // Verify 100% success rate
    expect(summary.total).toBe(iterations);
    expect(summary.completed).toBe(iterations);
    expect(summary.failed).toBe(0);
    expect(summary.successRate).toBe(100);
    expect(summary.errors).toHaveLength(0);

    // Verify latency metrics recording
    expect(summary.latencies.min).toBeGreaterThanOrEqual(0);
    expect(summary.latencies.max).toBeGreaterThanOrEqual(summary.latencies.min);
    expect(summary.latencies.avg).toBeGreaterThanOrEqual(0);
    expect(summary.latencies.p95).toBeGreaterThanOrEqual(summary.latencies.min);

    // Verify backend endpoint hit counts (each iteration hits all 4 endpoints)
    expect(hitCounts.calc).toBe(iterations);
    expect(hitCounts.timestamp).toBe(iterations);
    expect(hitCounts.excuse).toBe(iterations);
    expect(hitCounts.dice).toBe(iterations);
  });

  it('2. should execute Runner in "frontend" mode driving Playwright with route rewriting and verifying UI interactions', async () => {
    const logger = new Logger({ silent: true });
    const iterations = 2;

    const runner = new Runner({
      targetUrls: {
        frontendUrl,
        backendUrl,
      },
      mode: 'frontend',
      iterations,
      concurrency: 1,
      delayMs: 0,
      closeDelayMs: 0,
      headless: true,
      logger,
    });

    const summary = await runner.start();

    // Verify metrics and success rate
    expect(summary.total).toBe(iterations);
    expect(summary.completed).toBe(iterations);
    expect(summary.failed).toBe(0);
    expect(summary.successRate).toBe(100);
    expect(summary.errors).toHaveLength(0);

    // Verify latencies
    expect(summary.latencies.min).toBeGreaterThanOrEqual(0);
    expect(summary.latencies.avg).toBeGreaterThanOrEqual(0);

    // Verify backend endpoint hits routed from frontend browser fetch via context.route rewriting
    expect(hitCounts.calc).toBe(iterations);
    expect(hitCounts.timestamp).toBe(iterations);
    expect(hitCounts.excuse).toBe(iterations);
    expect(hitCounts.dice).toBe(iterations);
  });

  it('3. should execute Runner in "both" mode with concurrency > 1 across multiple iterations and worker pool coordination', async () => {
    const logger = new Logger({ silent: true });
    const iterations = 4;
    const concurrency = 2;

    const runner = new Runner({
      targetUrls: {
        frontendUrl,
        backendUrl,
      },
      mode: 'both',
      iterations,
      concurrency,
      delayMs: 10,
      closeDelayMs: 0,
      headless: true,
      logger,
    });

    const summary = await runner.start();

    // Verify execution metrics
    expect(summary.total).toBe(iterations);
    expect(summary.completed).toBe(iterations);
    expect(summary.failed).toBe(0);
    expect(summary.successRate).toBe(100);
    expect(summary.errors).toHaveLength(0);

    // In "both" mode, each iteration performs 1 frontend cycle (4 API hits) and 1 backend cycle (4 API hits)
    // Total hits per endpoint should be iterations * 2
    const expectedHitsPerEndpoint = iterations * 2;
    expect(hitCounts.calc).toBe(expectedHitsPerEndpoint);
    expect(hitCounts.timestamp).toBe(expectedHitsPerEndpoint);
    expect(hitCounts.excuse).toBe(expectedHitsPerEndpoint);
    expect(hitCounts.dice).toBe(expectedHitsPerEndpoint);

    // Verify latencies
    expect(summary.latencies.min).toBeGreaterThanOrEqual(0);
    expect(summary.latencies.max).toBeGreaterThanOrEqual(summary.latencies.min);
    expect(summary.latencies.avg).toBeGreaterThanOrEqual(0);
  });

  it('4. should cleanly teardown and stop early when aborted', async () => {
    const logger = new Logger({ silent: true });

    const runner = new Runner({
      targetUrls: {
        frontendUrl,
        backendUrl,
      },
      mode: 'backend',
      iterations: 20,
      concurrency: 1,
      delayMs: 50,
      logger,
    });

    const startPromise = runner.start();
    // Allow the first iteration to complete, then signal stop
    await new Promise((resolve) => setTimeout(resolve, 80));
    runner.stop();

    const summary = await startPromise;

    expect(runner.isAborted()).toBe(true);
    expect(summary.total).toBeLessThan(20);
    expect(summary.completed).toBeGreaterThanOrEqual(1);
  });
});
