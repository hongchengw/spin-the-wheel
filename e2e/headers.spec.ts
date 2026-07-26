/**
 * The security headers, checked against a real browser rather than a JSON blob.
 *
 * A CSP is the one piece of hardening that can only fail in production: nothing
 * in the unit suite or the ordinary e2e run sends a single response header, so
 * a policy that quietly blocks the app's own stylesheet would pass everything
 * and break the deployed site. The headers are therefore parsed straight out of
 * `vercel.json` and served over the built `dist/` by a local server, so this
 * spec exercises the exact policy the deploy will send — and drifts the moment
 * that file changes.
 *
 * The load-bearing assertion is that a *full spin* runs clean under the policy:
 * two places in the app write styles from script (`form.ts`'s swatch custom
 * property and `app.ts`'s dodge transform), and those are the things a careless
 * `style-src` would kill.
 */

import { test, expect, type Page } from '@playwright/test';
import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
import { fillOptions, TYPED } from './helpers';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

/** Long enough for stage 1 to have handed over to the constant spin. */
const PAST_HANDOFF_MS = 6000;

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

/**
 * The headers vercel.json applies to every path. Read from the file rather
 * than restated here, so this spec cannot certify a policy the deploy is not
 * actually sending.
 */
async function configuredHeaders(): Promise<Record<string, string>> {
  const raw = await readFile(join(ROOT, 'vercel.json'), 'utf8');
  const config = JSON.parse(raw) as { headers?: HeaderRule[] };
  const rule = config.headers?.find((entry) => entry.source === '/(.*)');
  if (!rule) throw new Error('vercel.json has no catch-all headers rule');

  return Object.fromEntries(rule.headers.map(({ key, value }) => [key, value]));
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function contentTypeFor(path: string): string {
  const dot = path.lastIndexOf('.');
  return (dot === -1 ? undefined : CONTENT_TYPES[path.slice(dot)]) ?? 'application/octet-stream';
}

/**
 * Serves `dist/` with the configured headers on every response. Bound to port
 * 0 so the two Playwright projects can run this spec concurrently without
 * fighting over a port.
 */
async function startServer(): Promise<{ server: Server; origin: string }> {
  const headers = await configuredHeaders();

  const server = createServer((req, res) => {
    const path = (req.url ?? '/').split('?')[0];
    // `normalize` collapses any `..` before the join, so a traversal attempt
    // cannot climb out of dist and serve the repo.
    const relative = normalize(path === '/' ? 'index.html' : path.replace(/^\/+/, ''));
    if (relative.startsWith('..')) {
      res.writeHead(403).end();
      return;
    }

    readFile(join(DIST, relative))
      .then((body) => {
        res.writeHead(200, { ...headers, 'Content-Type': contentTypeFor(relative) });
        res.end(body);
      })
      .catch(() => {
        res.writeHead(404, headers).end();
      });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (typeof address === 'string' || address === null) {
    throw new Error('server did not bind a port');
  }
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

let server: Server;
let origin: string;

test.beforeAll(async () => {
  ({ server, origin } = await startServer());
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

interface Violations {
  csp: string[];
  console: string[];
  pageErrors: string[];
}

/**
 * Loads the app under the policy, collecting every violation the page can
 * report. The CSP listener is installed via an init script so it is in place
 * before the document's own script runs — a listener added after navigation
 * would miss the violations that matter most.
 */
async function loadWithReporting(page: Page): Promise<Violations> {
  const found: Violations = { csp: [], console: [], pageErrors: [] };

  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      (window as unknown as { __csp: string[] }).__csp.push(
        `${event.violatedDirective} blocked ${event.blockedURI}`,
      );
    });
  });

  page.on('console', (message) => {
    if (message.type() === 'error') found.console.push(message.text());
  });
  page.on('pageerror', (error) => found.pageErrors.push(error.message));

  await page.goto(origin + '/');
  return found;
}

async function readCspViolations(page: Page): Promise<string[]> {
  return page.evaluate(() => (window as unknown as { __csp: string[] }).__csp ?? []);
}

test('every configured header is sent on the document', async ({ page }) => {
  const expected = await configuredHeaders();
  const response = await page.goto(origin + '/');
  const sent = response!.headers();

  for (const [key, value] of Object.entries(expected)) {
    expect(sent[key.toLowerCase()], `${key} header`).toBe(value);
  }
});

test('the policy refuses framing and sniffing', async () => {
  const headers = await configuredHeaders();

  expect(headers['Content-Security-Policy']).toContain("frame-ancestors 'none'");
  expect(headers['X-Frame-Options']).toBe('DENY');
  expect(headers['X-Content-Type-Options']).toBe('nosniff');
  // The app makes no requests of its own, so nothing legitimate is lost by
  // refusing them all — and an injected exfiltration attempt has nowhere to go.
  expect(headers['Content-Security-Policy']).toContain("connect-src 'none'");
});

/**
 * The framing check has to be same-origin to mean anything.
 *
 * A cross-origin frame's `contentDocument` is null whatever headers it carries,
 * so framing from another origin would pass this test with the policy removed
 * entirely. `frame-ancestors 'none'` refuses *every* ancestor including a
 * same-origin one, so framing the app from itself is the case that only passes
 * when the header is really doing the work.
 */
test('the app refuses to be framed, even by its own origin', async ({ page }) => {
  await page.goto(origin + '/');

  const framed = await page.evaluate(async (target) => {
    const frame = document.createElement('iframe');
    const settled = new Promise((resolve) => {
      frame.addEventListener('load', resolve);
      frame.addEventListener('error', resolve);
      setTimeout(resolve, 3000);
    });
    frame.src = target;
    document.body.appendChild(frame);
    await settled;

    try {
      // Same origin, so a permitted frame hands back a real document with the
      // app's heading in it.
      return frame.contentDocument?.querySelector('h1')?.textContent ?? null;
    } catch {
      return null;
    }
  }, origin + '/');

  expect(framed).toBeNull();
});

test('the app loads under the policy with no violations', async ({ page }) => {
  const found = await loadWithReporting(page);

  await expect(page.locator('h1')).toHaveText('Normal Spin The Wheel');
  // The stylesheet is a separate request; if style-src blocked it the page
  // would still have a heading but no layout at all.
  const styled = await page.evaluate(
    () => getComputedStyle(document.querySelector('h1')!).fontSize,
  );
  expect(styled).not.toBe('');

  expect(await readCspViolations(page), 'CSP violations').toEqual([]);
  expect(found.pageErrors, 'page errors').toEqual([]);
  expect(found.console, 'console errors').toEqual([]);
});

test('a full spin runs clean under the policy', async ({ page }) => {
  const found = await loadWithReporting(page);

  // The swatches are the first script-written style on the page: form.ts sets
  // a custom property on each one.
  await fillOptions(page, TYPED);
  const swatch = await page.evaluate(
    () => document.querySelector<HTMLElement>('.field__swatch')!.style.getPropertyValue('--swatch'),
  );
  expect(swatch).not.toBe('');

  await page.click('#spin-btn');
  await expect(page.locator('#wheel svg')).toBeVisible();
  await expect(page.locator('#wheel svg text')).toHaveCount(TYPED.length);

  await page.waitForTimeout(PAST_HANDOFF_MS);

  // The dodge is the other script-written style, and the one that would be
  // silently dead under a policy that blocked inline styles.
  const centre = await page.evaluate(() => {
    const rect = document.querySelector('#stop-btn')!.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
  await page.mouse.move(centre.x, centre.y, { steps: 10 });
  await page.waitForTimeout(400);

  const moved = await page.evaluate((from) => {
    const rect = document.querySelector('#stop-btn')!.getBoundingClientRect();
    return Math.hypot(rect.left + rect.width / 2 - from.x, rect.top + rect.height / 2 - from.y);
  }, centre);
  expect(moved).toBeGreaterThan(20);

  // The wheel is still turning, which is the whole point of the app.
  await expect(page.locator('#wheel')).toHaveClass(/is-spinning/);

  expect(await readCspViolations(page), 'CSP violations').toEqual([]);
  expect(found.pageErrors, 'page errors').toEqual([]);
  expect(found.console, 'console errors').toEqual([]);
});
