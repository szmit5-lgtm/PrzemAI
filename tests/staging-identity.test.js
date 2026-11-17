'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateStaging, APPROVED } = require('../scripts/assert-isolated-staging');

function fixture() {
  return {
    RAILWAY_ENVIRONMENT_NAME: 'staging',
    RAILWAY_PROJECT_ID: APPROVED.projectId,
    RAILWAY_ENVIRONMENT_ID: APPROVED.environmentId,
    RAILWAY_SERVICE_ID: APPROVED.apiServiceId,
    RAILWAY_GIT_BRANCH: 'safety/infra-staging-identity-20261117',
    DATABASE_URL: 'postgresql://synthetic:synthetic@db.staging.invalid:5432/test_db',
    STAGING_DB_HOST: 'db.staging.invalid',
    STAGING_DB_NAME: 'test_db',
    E2E_SYNTHETIC_ONLY: 'true',
  };
}

test('synthetic staging fixture passes static preflight', () => {
  assert.deepEqual(validateStaging(fixture()), []);
});
for (const [key, value] of [
  ['RAILWAY_ENVIRONMENT_NAME', 'production'],
  ['RAILWAY_PROJECT_ID', 'other-project'],
  ['RAILWAY_ENVIRONMENT_ID', '93d636bd-faba-4a8e-8522-b7b75be2de6c'],
  ['RAILWAY_SERVICE_ID', '8473a177-7172-4eb1-9d6f-96fe1df3f73d'],
  ['RAILWAY_GIT_BRANCH', 'feature/agent-runtime-finance-mail'],
  ['E2E_SYNTHETIC_ONLY', 'false'],
  ['STAGING_DB_HOST', 'unapproved.invalid'],
  ['STAGING_DB_NAME', 'wrong_db'],
]) {
  test('rejects unsafe ' + key, () => {
    const env = { ...fixture(), [key]: value };
    assert.ok(validateStaging(env).length > 0);
  });
}
test('missing Railway identity always fails closed', () => {
  const env = fixture();
  delete env.RAILWAY_ENVIRONMENT_ID;
  assert.ok(validateStaging(env).some(x => x.includes('environment ID')));
});
