/**
 * Subdomain Routing & Multi-Portal Isolation Unit Tests
 * Verifies host header rewriting for:
 * - admin.domain.com -> /admin...
 * - worker.domain.com -> /worker...
 * - tv.domain.com -> /tv...
 * - domain.com / www.domain.com -> public portal
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Dynamically import the ES module middleware
async function getMiddleware() {
  const mod = await import('../../middleware.js');
  return mod.middleware;
}

test('Subdomain Routing Unit Tests', async (t) => {
  const middleware = await getMiddleware();

  await t.test('1. admin.domain.com/ redirects unauthenticated admin to /login on subdomain', async () => {
    const req = new Request('https://admin.pondfish.example.com/', {
      headers: { host: 'admin.pondfish.example.com' },
    });
    const res = await middleware(req);
    assert.ok(res, 'Middleware must return a response');
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(location.includes('/login'), `Expected redirect to /login, got: ${location}`);
  });

  await t.test('2. admin.domain.com/login unauthenticated rewrites internally to /admin/login', async () => {
    const req = new Request('https://admin.pondfish.example.com/login', {
      headers: { host: 'admin.pondfish.example.com' },
    });
    const res = await middleware(req);
    assert.ok(res, 'Middleware must return a response');
    // NextResponse.rewrite returns x-middleware-rewrite header
    const rewriteHeader = res.headers.get('x-middleware-rewrite');
    assert.ok(rewriteHeader && rewriteHeader.includes('/admin/login'), `Expected rewrite to /admin/login, got: ${rewriteHeader}`);
  });

  await t.test('3. worker.domain.com/ redirects unauthenticated worker to /login on subdomain', async () => {
    const req = new Request('https://worker.pondfish.example.com/', {
      headers: { host: 'worker.pondfish.example.com' },
    });
    const res = await middleware(req);
    assert.ok(res, 'Middleware must return a response');
    assert.strictEqual(res.status, 307);
    const location = res.headers.get('location');
    assert.ok(location.includes('/login'), `Expected redirect to /login, got: ${location}`);
  });

  await t.test('4. tv.domain.com/ rewrites internally to /tv', async () => {
    const req = new Request('https://tv.pondfish.example.com/', {
      headers: { host: 'tv.pondfish.example.com' },
    });
    const res = await middleware(req);
    assert.ok(res, 'Middleware must return a response');
    const rewriteHeader = res.headers.get('x-middleware-rewrite');
    assert.ok(rewriteHeader && rewriteHeader.includes('/tv'), `Expected rewrite to /tv, got: ${rewriteHeader}`);
  });

  await t.test('5. main domain (pondfish.example.com/) passes through to public portal', async () => {
    const req = new Request('https://pondfish.example.com/', {
      headers: { host: 'pondfish.example.com' },
    });
    const res = await middleware(req);
    assert.ok(res, 'Middleware must return a response');
    assert.strictEqual(res.headers.get('x-middleware-rewrite'), null, 'Public domain must not be rewritten');
  });

  await t.test('6. API routes on admin subdomain pass through without being prefixed with /admin', async () => {
    const req = new Request('https://admin.pondfish.example.com/api/v1/admin/auth/login', {
      method: 'POST',
      headers: { host: 'admin.pondfish.example.com' },
    });
    const res = await middleware(req);
    assert.ok(res, 'Middleware must return a response');
    assert.strictEqual(res.status, 200, 'Public login API must return 200 pass-through');
  });
});

