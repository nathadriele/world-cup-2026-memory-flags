#!/usr/bin/env node
/**
 * Memory Cup 2026 - Master Test Runner
 *
 * Usage:
 *   node tests/run-all.js              # Run all suites (assumes server is running)
 *   node tests/run-all.js --start      # Auto-start server, run tests, then kill server
 *   node tests/run-all.js --suite=03   # Run only suite 03
 *
 * The runner executes each test suite sequentially, collects stats,
 * and prints a comprehensive summary at the end.
 */

const { spawn, execSync } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 3000;
const BASE = `http://localhost:${PORT}`;
const PROJECT_DIR = path.resolve(__dirname, '..');

// ── Parse CLI args ───────────────────────────────────────────
const args = process.argv.slice(2);
const shouldStartServer = args.includes('--start');
const suiteFilter = args.find(a => a.startsWith('--suite='));
const filterNum = suiteFilter ? suiteFilter.split('=')[1] : null;

// ── All test suites ──────────────────────────────────────────
const suites = [
  { num: '01', name: 'Authentication',  module: './01-auth.test.js' },
  { num: '02', name: 'Routes',          module: './02-routes.test.js' },
  { num: '03', name: 'Rooms',           module: './03-rooms.test.js' },
  { num: '04', name: 'Game Flow',       module: './04-game-flow.test.js' },
  { num: '05', name: 'Turn Rotation',   module: './05-turn-rotation.test.js' },
  { num: '06', name: 'Reveal Cards',    module: './06-reveal-cards.test.js' },
  { num: '07', name: 'Disconnect',      module: './07-disconnect.test.js' },
  { num: '08', name: 'Responsive',      module: './08-responsive.test.js' },
];

// ── Server management ────────────────────────────────────────
let serverProcess = null;

function checkServerHealth() {
  return new Promise((resolve) => {
    const req = http.get(`${BASE}/`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('  Starting server on port ' + PORT + '...');
    serverProcess = spawn('node', ['server.js'], {
      cwd: PROJECT_DIR,
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'pipe',
    });

    serverProcess.stdout.on('data', (data) => {
      const msg = data.toString();
      if (msg.includes('listening') || msg.includes('running') || msg.includes('started')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      // Suppress stderr unless it's critical
    });

    // Wait for server to be ready
    setTimeout(async () => {
      const ok = await checkServerHealth();
      if (ok) {
        resolve();
      } else {
        // Try once more
        setTimeout(async () => {
          const ok2 = await checkServerHealth();
          if (ok2) resolve();
          else reject(new Error('Server failed to start'));
        }, 2000);
      }
    }, 2000);
  });
}

function stopServer() {
  if (serverProcess) {
    try {
      serverProcess.kill('SIGTERM');
      setTimeout(() => {
        try { serverProcess.kill('SIGKILL'); } catch (e) {}
      }, 1000);
    } catch (e) {}
  }
}

// ── Kill anything on port 3000 ───────────────────────────────
function killPort() {
  try {
    execSync(`lsof -ti:${PORT} | xargs -r kill -9 2>/dev/null`, { stdio: 'ignore' });
  } catch (e) {}
}

// ── Main ─────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   Memory Cup 2026 - Automated Test Suite       ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');

  // Handle server lifecycle
  if (shouldStartServer) {
    killPort();
    await sleep(1000);
    try {
      await startServer();
      console.log('  Server is running.\n');
    } catch (e) {
      console.error('  ERROR: Could not start server: ' + e.message);
      process.exit(1);
    }
  } else {
    // Check if server is already running
    const ok = await checkServerHealth();
    if (!ok) {
      console.error('  ERROR: Server is not running on port ' + PORT + '.');
      console.error('  Start it first: node server.js');
      console.error('  Or use: node tests/run-all.js --start');
      process.exit(1);
    }
    console.log('  Server detected on port ' + PORT + '.\n');
  }

  // Reset stats
  const h = require('./helpers');
  h.resetStats();

  // Determine which suites to run
  const toRun = filterNum
    ? suites.filter(s => s.num === filterNum)
    : suites;

  if (filterNum && toRun.length === 0) {
    console.error('  No suite found with number: ' + filterNum);
    console.error('  Available: ' + suites.map(s => s.num).join(', '));
    stopServer();
    process.exit(1);
  }

  const startTime = Date.now();

  // Run each suite
  for (const suite of toRun) {
    try {
      const mod = require(suite.module);
      await mod.run();
    } catch (e) {
      console.error('  SUITE ERROR (' + suite.num + '): ' + e.message);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Print final summary
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║              FINAL TEST SUMMARY                ║');
  console.log('╠════════════════════════════════════════════════╣');

  const stats = h.getStats();
  const total = stats.passCount + stats.failCount;
  const pct = total > 0 ? Math.round((stats.passCount / total) * 100) : 0;

  // Build summary lines
  const lines = [
    `  Suites run:    ${toRun.length}/${suites.length}`,
    `  Total tests:   ${total}`,
    `  Passed:        ${stats.passCount}`,
    `  Failed:        ${stats.failCount}`,
    `  Pass rate:     ${pct}%`,
    `  Time:          ${elapsed}s`,
  ];

  lines.forEach(line => {
    const padded = line.padEnd(48);
    console.log('║' + padded + '║');
  });

  console.log('╠════════════════════════════════════════════════╣');

  // Per-suite breakdown
  const suiteBreakdown = {};
  stats.results.forEach(r => {
    if (!suiteBreakdown[r.suite]) {
      suiteBreakdown[r.suite] = { pass: 0, fail: 0 };
    }
    if (r.status === 'PASS') suiteBreakdown[r.suite].pass++;
    else suiteBreakdown[r.suite].fail++;
  });

  console.log('║  Per-Suite Breakdown:                          ║');
  for (const suite of suites) {
    const sd = suiteBreakdown[suite.name];
    if (!sd) continue;
    const status = sd.fail === 0 ? 'OK' : 'FAIL';
    const line = `    [${suite.num}] ${suite.name}: ${sd.pass} pass, ${sd.fail} fail  [${status}]`;
    const padded = line.padEnd(48);
    console.log('║' + padded + '║');
  }

  console.log('╚════════════════════════════════════════════════╝');

  // List failures in detail
  if (stats.failCount > 0) {
    console.log('\n  FAILED TESTS:');
    stats.results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log('    [' + r.suite + '] ' + r.name);
      if (r.error) console.log('      -> ' + r.error);
    });
    console.log('');
  }

  // Cleanup
  if (shouldStartServer) {
    stopServer();
    console.log('  Server stopped.');
  }

  // Exit code
  process.exit(stats.failCount > 0 ? 1 : 0);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Run
main().catch(e => {
  console.error('Fatal error:', e);
  stopServer();
  process.exit(1);
});
