'use strict';

// Fail closed. Railway resource IDs are public identifiers, not credentials.
// These pins were verified against the Railway project inventory on 2026-11-17.
// This check does NOT prove database connection identity; verify that separately.
const APPROVED = Object.freeze({
  projectId: '8b898b94-7bca-4a34-af28-8f114d776825',
  environmentId: '64404202-9c65-4076-a917-111e6448281a',
  apiServiceId: '1f155ed3-d2b7-4d65-b476-c040d02d8fa6',
});

function validateStaging(env) {
  const errors = [];
  const actual = (env.RAILWAY_ENVIRONMENT_NAME || '').trim().toLowerCase();
  if (actual !== 'staging') errors.push('RAILWAY_ENVIRONMENT_NAME must equal staging');
  if (env.RAILWAY_PROJECT_ID !== APPROVED.projectId) errors.push('Unapproved Railway project ID');
  if (env.RAILWAY_ENVIRONMENT_ID !== APPROVED.environmentId) errors.push('Unapproved Railway environment ID');
  if (env.RAILWAY_SERVICE_ID !== APPROVED.apiServiceId) errors.push('Unapproved Railway API service ID');

  const branch = (env.RAILWAY_GIT_BRANCH || '').trim();
  if (!branch.startsWith('safety/') && !branch.startsWith('fix/')) {
    errors.push('Railway source branch must be a reviewed safety/ or fix/ branch');
  }

  const db = env.DATABASE_URL || '';
  let parsed;
  try { parsed = new URL(db); } catch { errors.push('DATABASE_URL must be a valid PostgreSQL URL'); }
  if (parsed) {
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) errors.push('DATABASE_URL must use PostgreSQL');
    const host = parsed.hostname.toLowerCase();
    if (!host || /production|prod-db|primary-db/.test(host)) errors.push('Database host appears to be production or is missing');
    if (!env.STAGING_DB_HOST || host !== env.STAGING_DB_HOST.trim().toLowerCase()) {
      errors.push('DATABASE_URL hostname must exactly match approved STAGING_DB_HOST');
    }
    if (!env.STAGING_DB_NAME || decodeURIComponent(parsed.pathname.slice(1)) !== env.STAGING_DB_NAME) {
      errors.push('DATABASE_URL database name must exactly match approved STAGING_DB_NAME');
    }
  }
  if (env.E2E_SYNTHETIC_ONLY !== 'true') errors.push('E2E_SYNTHETIC_ONLY must equal true');
  return errors;
}

if (require.main === module) {
  const errors = validateStaging(process.env);
  if (errors.length) {
    console.error('Staging safety preflight FAILED:\n' + errors.map(e => '- ' + e).join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Staging identity preflight PASS; DB service identity and synthetic fixtures still require independent verification');
  }
}

module.exports = { validateStaging, APPROVED };
