import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const read = file => readFileSync(path.join(root, file), 'utf8');
export const readSource = file => read(`src/${file}`);
export const readBuild = file => read(`dist/${file}`);
export function loadCore() { vm.runInThisContext(readSource('core.js')); return globalThis.StreamGuardCore; }
export function loadCatalog() { vm.runInThisContext(readSource('catalog.js')); return globalThis.StreamGuardCatalog; }
export function loadBuildInfo() { vm.runInThisContext(readBuild('build-info.js')); return globalThis.StreamGuardBuild; }
export function loadPopups() { vm.runInThisContext(readBuild('popup-patterns.js')); return globalThis.StreamGuardPopups; }
