import http from 'node:http';
import type { AddressInfo } from 'node:net';

export const frontendHtml = `<!DOCTYPE html>
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

export interface MockServers {
  backendUrl: string;
  frontendUrl: string;
  stats: {
    calc: number;
    timestamp: number;
    excuse: number;
    dice: number;
    frontendPageLoads: number;
    /** Currently in-flight /api/calc requests (one per iteration cycle). */
    inFlightCalc: number;
    /** Peak simultaneous /api/calc requests observed. */
    maxInFlightCalc: number;
  };
  /** Artificial latency applied to /api/calc (lets tests observe concurrency). */
  setCalcLatencyMs(ms: number): void;
  reset(): void;
  close(): Promise<void>;
}

export async function startMockServers(): Promise<MockServers> {
  let calcLatencyMs = 0;
  const stats = {
    calc: 0,
    timestamp: 0,
    excuse: 0,
    dice: 0,
    frontendPageLoads: 0,
    inFlightCalc: 0,
    maxInFlightCalc: 0,
  };

  const json = (res: http.ServerResponse, body: unknown) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };

  const backend = http.createServer((req, res) => {
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
      stats.calc++;
      stats.inFlightCalc++;
      stats.maxInFlightCalc = Math.max(stats.maxInFlightCalc, stats.inFlightCalc);
      setTimeout(() => {
        stats.inFlightCalc--;
        json(res, { result: 16 });
      }, calcLatencyMs);
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/timestamp') {
      stats.timestamp++;
      json(res, {
        timestamp_iso: '2026-10-12T12:00:00.000Z',
        formatted_local: '12/10/2026',
        timezone: 'UTC',
      });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/api/daily-excuse') {
      stats.excuse++;
      json(res, { id: 1, excuse: 'Test excuse' });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/dice') {
      stats.dice++;
      json(res, { rolls: [3, 4], total: 7 });
      return;
    }
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not found: ${req.method} ${url.pathname}` }));
  });

  const frontend = http.createServer((_req, res) => {
    stats.frontendPageLoads++;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(frontendHtml);
  });

  const listen = (server: http.Server) =>
    new Promise<string>((resolve) =>
      server.listen(0, '127.0.0.1', () =>
        resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
      )
    );
  const backendUrl = await listen(backend);
  const frontendUrl = await listen(frontend);

  const closeServer = (server: http.Server) => {
    server.closeAllConnections?.();
    return new Promise<void>((resolve) => server.close(() => resolve()));
  };

  return {
    backendUrl,
    frontendUrl,
    stats,
    setCalcLatencyMs: (ms) => {
      calcLatencyMs = ms;
    },
    reset: () => {
      stats.calc = stats.timestamp = stats.excuse = stats.dice = 0;
      stats.frontendPageLoads = stats.inFlightCalc = stats.maxInFlightCalc = 0;
      calcLatencyMs = 0;
    },
    close: async () => {
      await closeServer(backend);
      await closeServer(frontend);
    },
  };
}
