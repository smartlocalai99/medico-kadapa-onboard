import test from 'node:test';
import assert from 'node:assert/strict';

import { applyHospitalChange } from '../utils/hospitalDirectory.mjs';

const alpha = { id: 'hospital-a', name: 'Alpha Hospital' };
const beta = { id: 'hospital-b', name: 'Beta Hospital' };

test('inserts a new hospital and keeps the directory sorted', () => {
  const result = applyHospitalChange([beta], {
    eventType: 'INSERT',
    new: alpha,
  });

  assert.deepEqual(result, [alpha, beta]);
});

test('replaces an updated hospital without adding a duplicate', () => {
  const updated = { ...beta, name: 'A Beta Hospital' };

  const result = applyHospitalChange([alpha, beta], {
    eventType: 'UPDATE',
    new: updated,
    old: beta,
  });

  assert.deepEqual(result, [updated, alpha]);
});

test('removes a deleted hospital', () => {
  const result = applyHospitalChange([alpha, beta], {
    eventType: 'DELETE',
    old: beta,
  });

  assert.deepEqual(result, [alpha]);
});
