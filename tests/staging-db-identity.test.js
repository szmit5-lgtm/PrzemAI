'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateDatabaseIdentity } = require('../scripts/verify-staging-db-identity');

const env = { STAGING_DB_NAME: 'staging_db', STAGING_DB_SERVER_ADDRESS: '10.0.0.7' };
const row = { database_name: 'staging_db', server_address: '10.0.0.7', in_recovery: false };

test('approved independent DB identity passes', () => {
  assert.deepEqual(validateDatabaseIdentity(row, env), []);
});
test('different database is rejected', () => {
  assert.match(validateDatabaseIdentity({ ...row, database_name: 'production' }, env).join(' '), /database name mismatch/);
});
test('different server is rejected', () => {
  assert.match(validateDatabaseIdentity({ ...row, server_address: '10.0.0.8' }, env).join(' '), /server address mismatch/);
});
test('missing independent server approval fails closed', () => {
  assert.match(validateDatabaseIdentity(row, { STAGING_DB_NAME: 'staging_db' }).join(' '), /approval missing/);
});
test('recovery state mismatch is rejected', () => {
  assert.match(validateDatabaseIdentity({ ...row, in_recovery: true }, env).join(' '), /recovery state/);
});
