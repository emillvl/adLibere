import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createZip, verifyZip } from '../tools/zip.mjs';
import { validateDistribution, filesIn } from '../tools/validate.mjs';

test('ZIP is deterministic, root-based and verifies binary and text bytes', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'adlibere-zip-test-'));
  try {
    mkdirSync(path.join(directory, 'resources'));
    writeFileSync(path.join(directory, 'manifest.json'), '{"manifest_version":3}\n');
    writeFileSync(path.join(directory, 'resources', 'binary.gif'), Buffer.from([0, 255, 128, 1]));
    const files = filesIn(directory);
    const archive = createZip(directory, files);
    assert.deepEqual(archive, createZip(directory, files.slice().reverse()));
    verifyZip(archive, directory, files);
    const corrupt = Buffer.from(archive);
    corrupt[14] ^= 1;
    assert.throws(() => verifyZip(corrupt, directory, files));
    assert.throws(() => createZip(directory, ['../outside']));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test('production validation rejects leaked development files and missing references', () => {
  const dist = path.resolve('dist');
  const result = validateDistribution(dist);
  assert.match(result.version, /^\d+\.\d+\.\d+$/);
  const directory = mkdtempSync(path.join(tmpdir(), 'adlibere-validation-test-'));
  try {
    for (const file of result.files) {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true });
      copyFileSync(path.join(dist, file), path.join(directory, file));
    }
    writeFileSync(path.join(directory, '.env'), 'TEST=not-a-secret');
    assert.throws(() => validateDistribution(directory), /unexpected development\/private file/);
    rmSync(path.join(directory, '.env'));
    rmSync(path.join(directory, 'content.bundle.js'));
    assert.throws(() => validateDistribution(directory), /Missing runtime asset/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
