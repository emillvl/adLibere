import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateDistribution } from './validate.mjs';
import { createZip, verifyZip } from './zip.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}`);
}

// Build once, then run the same suite used by npm test against those exact bytes.
run(process.execPath, ['tools/build.mjs']);
run(process.execPath, ['--test', 'tests/*.test.mjs']);
const dist = path.join(root, 'dist');
const output = path.join(root, 'release');
if (existsSync(output)) assert.ok(lstatSync(output).isDirectory() && !lstatSync(output).isSymbolicLink(), 'release must be a regular directory');
mkdirSync(output, { recursive: true });
const validated = validateDistribution(dist);
const name = `adLibere-v${validated.version}.zip`;
const archivePath = path.join(output, name);
const checksumPath = `${archivePath}.sha256`;
// Remove stale results before starting verification so failures leave no release candidate.
for (const file of [archivePath, checksumPath]) {
  if (existsSync(file)) assert.ok(lstatSync(file).isFile() && !lstatSync(file).isSymbolicLink(), `Unsafe output file: ${file}`);
  rmSync(file, { force: true });
}
const archive = createZip(dist, validated.files);
verifyZip(archive, dist, validated.files);
const temporary = mkdtempSync(path.join(tmpdir(), 'adlibere-release-'));
try {
  const temporaryArchive = path.join(temporary, name);
  const extracted = path.join(temporary, 'extracted');
  writeFileSync(temporaryArchive, archive);
  // Use a separate ZIP implementation for extraction before repeating validation.
  if (process.platform === 'win32') {
    run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '$ErrorActionPreference = "Stop"; Add-Type -AssemblyName System.IO.Compression.FileSystem; [System.IO.Compression.ZipFile]::ExtractToDirectory($env:ADLIBERE_ZIP, $env:ADLIBERE_EXTRACT)'],
    { env: { ...process.env, ADLIBERE_ZIP: temporaryArchive, ADLIBERE_EXTRACT: extracted } });
  } else {
    run('unzip', ['-q', temporaryArchive, '-d', extracted]);
  }
  assert.deepEqual(validateDistribution(extracted), validated);
  for (const file of validated.files) assert.deepEqual(readFileSync(path.join(extracted, file)), readFileSync(path.join(dist, file)), `Extraction mismatch: ${file}`);
  const hash = createHash('sha256').update(archive).digest('hex');
  writeFileSync(archivePath, archive);
  writeFileSync(checksumPath, `${hash}  ${name}\n`);
  console.log(`Packaged and independently extracted ${name}: ${archive.length} bytes`);
  console.log(`SHA-256: ${hash}`);
  console.log('Release files are in release/ (ignored by Git).');
} finally {
  // mkdtempSync created this exact directory under the operating-system temp root.
  if (path.dirname(temporary) !== path.resolve(tmpdir()) || !path.basename(temporary).startsWith('adlibere-release-')) throw new Error('Unsafe cleanup path');
  rmSync(temporary, { recursive: true, force: true });
}
