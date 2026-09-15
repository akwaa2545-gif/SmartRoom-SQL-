const assert = require('node:assert/strict');
const test = require('node:test');

const {
  getAdminDeviceLabel,
  getClientIp,
  normalizeIpAddress,
} = require('../src/admin-activity');

test('normalizes IPv4-mapped and valid IPv6 addresses', () => {
  assert.equal(normalizeIpAddress('::ffff:192.168.1.20'), '192.168.1.20');
  assert.equal(normalizeIpAddress('2001:db8::20'), '2001:db8::20');
  assert.equal(normalizeIpAddress('not-an-ip'), 'unknown');
});

test('uses a forwarded address only from a trusted local proxy', () => {
  const request = {
    socket: { remoteAddress: '127.0.0.1' },
    headers: { 'x-forwarded-for': '192.168.1.20, 127.0.0.1' },
  };
  assert.equal(getClientIp(request, true), '192.168.1.20');
  assert.equal(getClientIp(request, false), '127.0.0.1');
});

test('creates a coarse, privacy-safe device label from the user agent', () => {
  assert.equal(
    getAdminDeviceLabel('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36'),
    'Chrome on Windows (Desktop)',
  );
  assert.equal(
    getAdminDeviceLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'),
    'Safari on iOS (Mobile)',
  );
});
