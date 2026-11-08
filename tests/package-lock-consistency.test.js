const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('npm lockfile root metadata and declared dependencies match package.json', () => {
  const root = path.resolve(__dirname, '..');
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const lockedRoot = lock.packages?.[''];
  assert.ok(lockedRoot, 'package-lock.json must contain a root package entry');
  assert.equal(lock.name, manifest.name);
  assert.equal(lock.version, manifest.version);
  assert.equal(lockedRoot.name, manifest.name);
  assert.equal(lockedRoot.version, manifest.version);
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    assert.deepEqual(lockedRoot[field] ?? {}, manifest[field] ?? {},
      `package-lock.json root ${field} must match package.json; regenerate with npm install --package-lock-only`);
  }
});
