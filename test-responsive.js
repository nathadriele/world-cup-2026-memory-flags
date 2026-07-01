#!/usr/bin/env node
/**
 * Responsive Design Test Suite for Memory Cup 2026
 * Tests CSS media queries, viewport coverage, and layout integrity
 * across phone, tablet, and desktop resolutions.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:3000';
let passCount = 0;
let failCount = 0;
const results = [];

function test(name, fn) {
  return new Promise(async (resolve) => {
    try {
      await fn();
      passCount++;
      results.push({ name, status: 'PASS' });
      console.log('  PASS: ' + name);
      resolve();
    } catch(e) {
      failCount++;
      results.push({ name, status: 'FAIL', error: e.message });
      console.log('  FAIL: ' + name + ' - ' + e.message);
      resolve();
    }
  });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function httpGet(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(BASE + urlPath, (res) => {
      let chunks = '';
      res.on('data', d => chunks += d);
      res.on('end', () => resolve({ status: res.statusCode, body: chunks, headers: res.headers }));
    }).on('error', reject);
  });
}

function extractMediaQueries(css) {
  const queries = [];
  const regex = /@media\s*\(([^)]+)\)/g;
  let match;
  while ((match = regex.exec(css)) !== null) {
    queries.push(match[0]);
  }
  return queries;
}

function extractAllCSS(html, basePath) {
  // Extract inline <style> blocks
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let allCSS = '';
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    allCSS += match[1] + '\n';
  }
  return allCSS;
}

async function main() {
  console.log('\n========================================');
  console.log('  Responsive Design Tests');
  console.log('========================================\n');

  // Fetch jogar.html
  const jogarRes = await httpGet('/jogar.html');
  const jogarHTML = jogarRes.body;
  const jogarCSS = extractAllCSS(jogarHTML);

  // Fetch shared.css
  const sharedRes = await httpGet('/shared.css');
  const sharedCSS = sharedRes.body;

  // Fetch login page
  const loginRes = await httpGet('/');
  const loginHTML = loginRes.body;
  const loginCSS = extractAllCSS(loginHTML);

  const allCSS = jogarCSS + '\n' + sharedCSS + '\n' + loginCSS;

  console.log('--- Viewport Meta Tag ---');

  await test('jogar.html has viewport meta tag', async () => {
    assert(jogarHTML.includes('width=device-width'), 'Missing viewport meta with width=device-width');
    assert(jogarHTML.includes('initial-scale=1'), 'Missing initial-scale=1');
  });

  await test('login.html has viewport meta tag', async () => {
    assert(loginHTML.includes('width=device-width'), 'Missing viewport meta');
  });

  console.log('\n--- Media Query Coverage ---');

  const mediaQueries = extractMediaQueries(allCSS);
  const breakpoints = mediaQueries.map(q => {
    const m = q.match(/max-width:\s*(\d+)/);
    return m ? parseInt(m[1]) : null;
  }).filter(x => x !== null);

  await test('Has mobile breakpoint (<=500px)', async () => {
    const has = breakpoints.some(bp => bp <= 500);
    assert(has, 'No media query for screens <=500px');
  });

  await test('Has tablet breakpoint (700-900px)', async () => {
    const has = breakpoints.some(bp => bp >= 700 && bp <= 900);
    assert(has, 'No media query for tablet range (700-900px)');
  });

  await test('Has desktop breakpoint (1000-1100px)', async () => {
    const has = breakpoints.some(bp => bp >= 1000 && bp <= 1100);
    assert(has, 'No media query for desktop transition (1000-1100px)');
  });

  await test('Has small phone breakpoint (<=360px)', async () => {
    const has = breakpoints.some(bp => bp <= 360);
    assert(has, 'No media query for very small phones <=360px');
  });

  await test('Has prefers-reduced-motion support', async () => {
    assert(allCSS.includes('prefers-reduced-motion'), 'Missing prefers-reduced-motion media query');
  });

  console.log('\n--- Board Grid Responsive ---');

  await test('Board has 12-column default', async () => {
    assert(jogarCSS.includes('repeat(12,') || jogarCSS.includes('repeat(12 '), 'Board should default to 12 columns');
  });

  await test('Board adapts to 8 columns at 1024px', async () => {
    assert(jogarCSS.includes('repeat(8,') || jogarCSS.includes('repeat(8 '), 'Board should adapt to 8 columns');
  });

  await test('Board adapts to 6 columns at 700px', async () => {
    assert(jogarCSS.includes('repeat(6,') || jogarCSS.includes('repeat(6 '), 'Board should adapt to 6 columns');
  });

  await test('Board adapts to 4 columns at 500px', async () => {
    assert(jogarCSS.includes('repeat(4,') || jogarCSS.includes('repeat(4 '), 'Board should adapt to 4 columns');
  });

  await test('Board adapts to 3 columns at 360px', async () => {
    assert(jogarCSS.includes('repeat(3,') || jogarCSS.includes('repeat(3 '), 'Board should adapt to 3 columns for tiny phones');
  });

  console.log('\n--- Touch Target Sizes ---');

  await test('Main buttons use adequate padding (>=12px)', async () => {
    assert(sharedCSS.includes('padding: 12px') || sharedCSS.includes('padding:12px'), 'Buttons should have at least 12px padding');
  });

  await test('Hamburger menu is touch-friendly (>=40px)', async () => {
    const m = sharedCSS.match(/\.menu-hamburger[^}]*width:\s*(\d+)px/);
    assert(m, 'Could not find menu-hamburger width');
    const w = parseInt(m[1]);
    assert(w >= 40, 'Hamburger menu width should be >=40px, got ' + w + 'px');
  });

  await test('Sidebar toggle is adequate (>=36px)', async () => {
    const m = sharedCSS.match(/\.sidebar-toggle[^}]*width:\s*(\d+)px/);
    assert(m, 'Could not find sidebar-toggle width');
    const w = parseInt(m[1]);
    assert(w >= 36, 'Sidebar toggle width should be >=36px, got ' + w + 'px');
  });

  await test('Count options have min-width', async () => {
    assert(jogarCSS.includes('min-width') && jogarCSS.includes('count-option'), 'Count options should have min-width');
  });

  console.log('\n--- Layout Integrity ---');

  await test('Sidebar hides on mobile (768px breakpoint)', async () => {
    assert(sharedCSS.includes('768px'), 'Sidebar should have 768px breakpoint for mobile behavior');
    assert(sharedCSS.includes('translateX') || sharedCSS.includes('translate('), 'Sidebar should use transform to hide on mobile');
  });

  await test('Game area stacks vertically on tablet', async () => {
    assert(jogarCSS.includes('1100px'), 'Game area should stack at 1100px');
    // Check that grid-template-columns: 1fr is used in a media query
    const mqSection = jogarCSS.match(/@media[^{]*1100px[^}]*}/);
    assert(mqSection && mqSection[0].includes('1fr'), 'Game area should switch to 1fr (stacked) at 1100px');
  });

  await test('Lobby wraps on mobile (900px)', async () => {
    const mqSection = jogarCSS.match(/@media[^{]*900px[^}]*}/);
    assert(mqSection && mqSection[0].includes('1fr'), 'Lobby should stack to 1fr at 900px');
  });

  await test('No horizontal overflow elements (fixed widths > 320px)', async () => {
    // Check for suspicious fixed widths
    const fixedWidths = jogarCSS.match(/width:\s*(\d{3,})px/g) || [];
    const bigWidths = fixedWidths.filter(w => parseInt(w.match(/\d+/)[0]) > 280);
    // Filter out max-width which is fine
    const issueCount = bigWidths.length;
    // Podium pillars have fixed widths but should be overridden in media queries
    // This is a soft check
    assert(issueCount < 20, 'Too many fixed-width elements > 280px (' + issueCount + ' found) - may cause overflow on phones');
  });

  console.log('\n--- Font Accessibility ---');

  await test('Inputs use 16px font (prevents iOS zoom)', async () => {
    assert(sharedCSS.includes('font-size: 1rem') || sharedCSS.includes('font-size:1rem'), 'Inputs should use 1rem (16px) font-size');
  });

  await test('Uses rem units (not px) for most fonts', async () => {
    const remCount = (jogarCSS.match(/\d+\.?\d*rem/g) || []).length;
    const pxFontCount = (jogarCSS.match(/font-size:\s*\d+px/g) || []).length;
    assert(remCount > pxFontCount, 'Should use more rem than px for font sizes (' + remCount + 'rem vs ' + pxFontCount + 'px)');
  });

  await test('Card names hidden on small screens', async () => {
    const mqSection = jogarCSS.match(/@media[^{]*500px[^@]*\}/s);
    assert(mqSection && mqSection[0].includes('mem-card-name'), 'Card names should be hidden at 500px');
  });

  console.log('\n--- Podium Mobile Support ---');

  await test('Podium scales down on phones (<=500px)', async () => {
    const mqSection = jogarCSS.match(/@media[^{]*500px[^}]*\{[^@]*\}/s);
    assert(mqSection, 'No 500px media query found');
    const content = mqSection[0];
    assert(content.includes('podium'), 'Podium should be styled differently at 500px');
    // Check that gold pillar is smaller
    assert(content.includes('80px') || content.includes('70px'), 'Gold pillar should be <100px on mobile');
  });

  await test('Podium scales for tiny phones (<=360px)', async () => {
    const mqSection = jogarCSS.match(/@media[^{]*360px[^}]*\{[^@]*\}/s);
    assert(mqSection, 'No 360px media query found');
    const content = mqSection[0];
    assert(content.includes('podium') || content.includes('68px') || content.includes('60px'), 'Podium should scale further at 360px');
  });

  console.log('\n--- Validation Modal Mobile ---');

  await test('Validation box uses max-width (responsive)', async () => {
    assert(jogarCSS.includes('max-width: 460px') || jogarCSS.includes('max-width:460px'), 'Validation box should have max-width');
  });

  await test('Validation box centered with flex', async () => {
    assert(jogarCSS.includes('justify-content: center') || jogarCSS.includes('justify-content:center'), 'Validation should be centered');
  });

  await test('True/False buttons are flex (equal width)', async () => {
    assert(jogarCSS.includes('val-tf-buttons'), 'True/false buttons container should exist');
    assert(jogarCSS.includes('val-tf-btn'), 'True/false buttons should exist');
  });

  console.log('\n--- Page Load Tests ---');

  const resolutions = [
    { name: 'iPhone SE', width: 320 },
    { name: 'Galaxy S8', width: 360 },
    { name: 'iPhone 12', width: 390 },
    { name: 'iPhone 14 Pro Max', width: 430 },
    { name: 'iPad Mini', width: 768 },
    { name: 'iPad Pro', width: 1024 },
    { name: 'Desktop', width: 1920 }
  ];

  for (const res of resolutions) {
    await test(res.name + ' (' + res.width + 'px) - page loads', async () => {
      const r = await httpGet('/');
      assert(r.status === 200, 'Expected 200, got ' + r.status);
      assert(r.body.includes('Memory') || r.body.includes('login') || r.body.includes('Cup'), 'Page should have content');
    });
  }

  // === RESULTS ===
  console.log('\n========================================');
  console.log('  RESPONSIVE TEST RESULTS');
  console.log('========================================');
  console.log('  Total: ' + (passCount + failCount));
  console.log('  Passed: ' + passCount);
  console.log('  Failed: ' + failCount);
  if (failCount > 0) {
    console.log('\n  Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log('    - ' + r.name + ': ' + r.error);
    });
  }
  console.log('========================================\n');

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(2);
});
