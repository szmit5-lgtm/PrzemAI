#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Use an isolated PostgreSQL database}"
: "${PRZEMAI_TEST_POSTGRES_CONTAINER:?Use a disposable local PostgreSQL 16 container}"
node -e 'const u=new URL(process.env.DATABASE_URL); if(u.protocol!=="postgresql:"||u.hostname!=="127.0.0.1"||!/^\/przemai_p0_e2e_[a-z0-9_]+$/.test(u.pathname)||u.search||u.hash)process.exit(1)'
[[ "$PRZEMAI_TEST_POSTGRES_CONTAINER" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]]
pg() { local command=$1; shift; docker exec -i "$PRZEMAI_TEST_POSTGRES_CONTAINER" "$command" -U postgres "$@"; }
root=$PWD
scratch=$(mktemp -d)
trap 'rm -rf "$scratch"' EXIT
chmod 700 "$scratch"
api_sha=d2e9833e828fc78ee89d3aac5616543ead443b7f
worker_sha=729ef733d114a2ab7d611e9139394867873cc34d
for entry in "api:$api_sha" "worker:$worker_sha"; do
  component=${entry%%:*}
  sha=${entry#*:}
  git cat-file -e "$sha^{commit}" 2>/dev/null || git fetch --no-tags origin "$sha"
  mkdir "$scratch/$component"
  git archive "$sha" | tar -x -C "$scratch/$component"
  (
    cd "$scratch/$component"
    FFMPEG_BIN="$(command -v ffmpeg)" npm ci --no-audit --no-fund
    ./node_modules/.bin/prisma generate
  )
done
# createdb fails if the name already exists. Never clean up an existing database.
suffix=$(node -e 'process.stdout.write(require("crypto").randomBytes(6).toString("hex"))')
source_db=przemai_p0_e2e_old_$suffix
restore_db=przemai_p0_e2e_restore_$suffix
pg createdb "$source_db"
pg createdb "$restore_db"
db_url() { node -e 'const u=new URL(process.env.DATABASE_URL); u.pathname="/"+process.argv[1]; process.stdout.write(u.href)' "$1"; }
export DATABASE_URL="$(db_url "$source_db")"
(
  cd "$scratch/api"
  ./node_modules/.bin/prisma migrate deploy
  node - <<'JS'
const db = new (require("@prisma/client").PrismaClient)();
(async () => {
  await db.user.create({ data: { id: "cutover-owner", email: "cutover@example.test", password: "fixture" } });
  await db.task.create({ data: { id: "cutover-legacy-queue", userId: "cutover-owner",
    title: "Legacy queue fixture", tags: [], status: "TODO" } });
  await db.chatConversation.create({ data: { id: "cutover-web", userId: "cutover-owner", title: "Backup fixture" } });
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
JS
)
pg pg_dump --format=custom --no-owner --no-privileges "$source_db" > "$scratch/backup.dump"
pg pg_restore --exit-on-error --single-transaction --no-owner --no-privileges -d "$restore_db" < "$scratch/backup.dump"
for db in "$source_db" "$restore_db"; do
  pg psql -X -At -v ON_ERROR_STOP=1 -d "$db" -c '
    SELECT id, title FROM "ChatConversation" WHERE id = '\''cutover-web'\'';
    SELECT id, status FROM "Task" WHERE id = '\''cutover-legacy-queue'\'';
    SELECT migration_name, checksum FROM "_prisma_migrations" ORDER BY migration_name;
  ' > "$scratch/$db.txt"
done
test -s "$scratch/$source_db.txt"
cmp "$scratch/$source_db.txt" "$scratch/$restore_db.txt"
echo "PostgreSQL backup and restore: fixture and Prisma migration ledger match"

export DATABASE_URL="$(db_url "$restore_db")"
cd "$root"
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate status
node scripts/testProductionCutover.js "$scratch/api" "$scratch/worker"
