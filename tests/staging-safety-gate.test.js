'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateStaging, APPROVED } = require('../scripts/assert-isolated-staging');
const valid = () => ({
  RAILWAY_ENVIRONMENT_NAME: 'staging',
  RAILWAY_PROJECT_ID: APPROVED.projectId,
  RAILWAY_ENVIRONMENT_ID: APPROVED.environmentId,
  RAILWAY_SERVICE_ID: APPROVED.apiServiceId,
  RAILWAY_GIT_BRANCH: 'safety/infra-staging-preflight-20261117',
  DATABASE_URL: 'postgresql://synthetic:synthetic@staging-db.internal:5432/przemai_synthetic',
  STAGING_DB_HOST: 'staging-db.internal',
  STAGING_DB_NAME: 'przemai_synthetic',
  E2E_SYNTHETIC_ONLY: 'true'
});
test('approved isolated staging passes preflight', () => assert.deepEqual(validateStaging(valid()), []));
test('production Railway environment fails closed', () => {
  const env = valid(); env.RAILWAY_ENVIRONMENT_NAME = 'production';
  assert.ok(validateStaging(env).length);
});
test('production branch fails closed', () => {
  const env = valid(); env.RAILWAY_GIT_BRANCH = 'feature/agent-runtime-finance-mail';
  assert.ok(validateStaging(env).length);
});
test('database host mismatch fails closed', () => {
  const env = valid(); env.DATABASE_URL = 'postgresql://x:y@production-db:5432/przemai_synthetic';
  assert.ok(validateStaging(env).length);
});
test('database name mismatch fails closed', () => {
  const env = valid(); env.DATABASE_URL = 'postgresql://x:y@staging-db.internal:5432/real_finances';
  assert.ok(validateStaging(env).length);
});
test('synthetic-only flag required', () => {
  const env = valid(); delete env.E2E_SYNTHETIC_ONLY;
  assert.ok(validateStaging(env).length);
});
test('invalid URL fails closed without leaking credentials', () => {
  const env = valid(); env.DATABASE_URL = 'secret-password';
  assert.ok(validateStaging(env).length);
});

for (const [key, label] of [['RAILWAY_PROJECT_ID', 'project'], ['RAILWAY_ENVIRONMENT_ID', 'environment'], ['RAILWAY_SERVICE_ID', 'API service']]) {
  test(`unapproved Railway ${label} identity fails closed`, () => {
    const env = valid(); env[key] = '00000000-0000-0000-0000-000000000000';
    assert.ok(validateStaging(env).length);
  });
}
