'use strict';

// Manual, read-only diagnostic. NEVER run before verifying Railway inventory.
// Does not change schema, data, Railway variables or service configuration.
const { validateStaging } = require('./assert-isolated-staging');

function validateDatabaseIdentity(row, env) {
  const errors = [];
  const expectedName = (env.STAGING_DB_NAME || '').trim();
  const expectedAddress = (env.STAGING_DB_SERVER_ADDRESS || '').trim();
  if (!expectedName || row.database_name !== expectedName) errors.push('Connected database name mismatch');
  // Address must be obtained independently from the approved Railway PostgreSQL service.
  if (!expectedAddress) errors.push('Independent STAGING_DB_SERVER_ADDRESS approval missing');
  else if (String(row.server_address || '') !== expectedAddress) errors.push('Connected server address mismatch');
  if (row.in_recovery !== false) errors.push('Unexpected PostgreSQL recovery state');
  return errors;
}

async function main(env = process.env) {
  const errors = validateStaging(env);
  if (errors.length) throw new Error('Railway staging preflight failed: ' + errors.join('; '));
  if (!env.STAGING_DB_SERVER_ADDRESS) throw new Error('Independent DB server address approval required');
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    // A read-only transaction prevents accidental mutations by future edits.
    const rows = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      return tx.$queryRawUnsafe('SELECT current_database() AS database_name, host(inet_server_addr()) AS server_address, pg_is_in_recovery() AS in_recovery');
    });
    if (rows.length !== 1) throw new Error('Unexpected PostgreSQL identity response');
    const identityErrors = validateDatabaseIdentity(rows[0], env);
    if (identityErrors.length) throw new Error(identityErrors.join('; '));
    console.log('PASS: approved staging PostgreSQL connection identity (read-only; no credentials or address printed)');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('FAIL: PostgreSQL identity verification: ' + error.message);
    process.exitCode = 1;
  });
}
module.exports = { validateDatabaseIdentity, main };
