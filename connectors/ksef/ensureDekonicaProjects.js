"use strict";
// Opt-in pilot provisioning: only the verified KSeF owner, in their own account.
// Never copy KSeF data or projects to other users or organizations.
const PILOT_PROJECTS = Object.freeze([
  {name:"Zgorzelec",aliases:["budowa Zgorzelec","Zgorzelec CO","Zgorzelec CWU"]},
  {name:"Mielno",aliases:["budowa Mielno","Mielno Unihouse"]}
]);
async function ensureDekonicaProjects({prisma,userId,env=process.env}={}){
  if(!env || env.KSEF_SEED_DEKONICA_PROJECTS!=="true" ||
    typeof userId!=="string" || !userId ||
    env.KSEF_OWNER_USER_ID!==userId ||
    !prisma?.project?.findMany || !prisma?.project?.create) return 0;
  const existing=await prisma.project.findMany({
    where:{userId,status:"ACTIVE"},
    select:{name:true,company:true,aliases:true},take:300
  });
  let created=0;
  for(const project of PILOT_PROJECTS){
    if(existing.some(item=>item.name?.trim().toLocaleLowerCase("pl-PL")===
      project.name.toLocaleLowerCase("pl-PL") &&
      /dekonica/i.test(item.company || "")))continue;
    await prisma.project.create({data:{
      userId,name:project.name,company:"Dekonica",aliases:project.aliases,status:"ACTIVE"
    }});
    created+=1;
  }
  return created;
}
module.exports={ensureDekonicaProjects};
