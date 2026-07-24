import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deriveEndpointSecret, signPayload, timingSafeEqualStr } from '../src/shared/signing.js';

test('derived secret is deterministic per (endpoint, version)', () => {
  const a = deriveEndpointSecret('master', 'ep_1', 1);
  const b = deriveEndpointSecret('master', 'ep_1', 1);
  assert.equal(a, b);
});

test('rotating the key version changes the secret', () => {
  const v1 = deriveEndpointSecret('master', 'ep_1', 1);
  const v2 = deriveEndpointSecret('master', 'ep_1', 2);
  assert.notEqual(v1, v2);
});

test('signature is reproducible and verifies in constant time', () => {
  const secret = deriveEndpointSecret('master', 'ep_1', 1);
  const sig1 = signPayload(secret, '1000', '{"a":1}');
  const sig2 = signPayload(secret, '1000', '{"a":1}');
  assert.equal(timingSafeEqualStr(sig1, sig2), true);
});

test('a different timestamp yields a different signature (replay-resistant)', () => {
  const secret = deriveEndpointSecret('master', 'ep_1', 1);
  assert.notEqual(signPayload(secret, '1000', '{}'), signPayload(secret, '1001', '{}'));
});

test('timingSafeEqualStr handles unequal lengths without throwing', () => {
  assert.equal(timingSafeEqualStr('abc', 'abcd'), false);
});
