#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Use an isolated PostgreSQL database}"
node -e 'const u=new URL(process.env.DATABASE_URL); if(u.protocol!=="postgresql:"||u.hostname!=="127.0.0.1"||!/^\/przemai_p0_e2e_[a-z0-9_]+$/.test(u.pathname)||u.search||u.hash)process.exit(1)'
root=$PWD
scratch=$(mktemp -d)
api_pid=
worker_pid=
cleanup() {
  for pid in "$api_pid" "$worker_pid"; do
    if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; wait "$pid" || true; fi
  done
  rm -rf "$scratch"
}
trap cleanup EXIT
echo "Preparing previous P0 checkout"
git archive 45b4fcd61a4a4794c04b061011549a1974a56ae1 | tar -x -C "$scratch"
cp -a node_modules "$scratch/"
(
  cd "$scratch"
  echo "Generating previous P0 client and applying previous schema"
  ./node_modules/.bin/prisma generate
  ./node_modules/.bin/prisma migrate deploy
  node - <<'JS'
const {PrismaClient}=require("@prisma/client");
const db=new PrismaClient();
(async()=>{
 const user=await db.user.create({data:{id:"rollback-fixture",email:"rollback@example.test",password:"synthetic"}});
 await db.chatConversation.createMany({data:[
  {id:"rollback-web",userId:user.id,title:"Browser fixture",channel:"WEB"},
  {id:"rollback-telegram",userId:user.id,title:"Telegram fixture",channel:"TELEGRAM"}
 ]});
 const org=await db.organization.create({data:{name:"Rollback fixture",slug:"rollback-whatsapp-fixture"}});
 await db.whatsAppMessage.create({data:{organizationId:org.id,externalMessageId:"wamid.rollback-fixture",
  phoneNumberId:"fixture",contactWaId:"48123456789",messageType:"text",text:"Existing WhatsApp message"}});
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
JS
)
echo "Generating candidate client and applying candidate migrations"
./node_modules/.bin/prisma generate
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate deploy
./node_modules/.bin/prisma migrate status
echo "Starting previous P0 API and worker with AI disabled"
(
  cd "$scratch"
  exec env -i PATH="$PATH" DATABASE_URL="$DATABASE_URL" PORT=3917 JWT_SECRET=local-rollback-only OPENAI_DAILY_REQUEST_LIMIT=0 node server.js
) > "$scratch/api.log" 2>&1 &
api_pid=$!
(
  cd "$scratch"
  exec env -i PATH="$PATH" DATABASE_URL="$DATABASE_URL" WORKER_OWNER_USER_ID=rollback-fixture OPENAI_DAILY_REQUEST_LIMIT=0 node worker.js
) > "$scratch/worker.log" 2>&1 &
worker_pid=$!
for i in {1..50}; do
  if curl --noproxy 127.0.0.1 -fsS http://127.0.0.1:3917/health >/dev/null 2>&1 &&
      grep -q '\[Worker\] Cycle' "$scratch/worker.log"; then break; fi
  sleep 0.3
done
if ! grep -Eq '\[Worker\] Cycle .*"users":1,.*"failed":0,' "$scratch/worker.log"; then
  cat "$scratch/worker.log" "$scratch/api.log"
  exit 1
fi
cd "$root"
node - <<'JS'
const assert=require("node:assert/strict");
const jwt=require("jsonwebtoken");
const endpoint="http://127.0.0.1:3917/api/chat";
const {PrismaClient}=require("@prisma/client");
const db=new PrismaClient();
const headers={Authorization:"Bearer "+jwt.sign({id:"rollback-fixture"},"local-rollback-only")};
(async()=>{
 const result=await fetch(endpoint,{headers});
 assert.equal(result.status,200);
 assert.deepEqual((await result.json()).conversations.map(row=>row.id),["rollback-web"]);
 assert.equal((await fetch(endpoint+"/rollback-telegram",{headers})).status,404);
 const message=await db.whatsAppMessage.findUniqueOrThrow({where:{externalMessageId:"wamid.rollback-fixture"}});
 assert.equal(message.text,"Existing WhatsApp message");
 assert.equal(message.draftState,null);
 console.log("Native Prisma migration and previous P0 API/worker smoke passed");
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>db.$disconnect());
JS
