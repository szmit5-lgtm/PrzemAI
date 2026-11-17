'use strict';

// Fail-closed guard before any synthetic staging E2E. Never prints credentials.
function validateStaging(env) {
  const errors = [];
  const actual = (env.RAILWAY_ENVIRONMENT_NAME || '').trim().toLowerCase();
  if (actual !== 'staging') errors.push('RAILWAY_ENVIRONMENT_NAME must equal staging');
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
  if (env.NODE_ENV === 'production' && actual !== 'staging') errors.push('Production environment prohibited');
  return errors;
}

if (require.main === module) {
  const errors = validateStaging(process.env);
  if (errors.length) {
    console.error('Staging safety preflight FAILED:\\n' + errors.map(e => '- ' + e).join('\\n'));
    process.exitCode = 1;
  } else {
    console.log('Staging safety preflight PASS (no network requests performed)');
  }
}

module.exports = { validateStaging };
