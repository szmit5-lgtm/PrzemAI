"use strict";

const prisma=require("../../lib/prisma");
const {OrganizationError}=require("./OrganizationService");
const {OrganizationFinanceService,ksefDocPredicate}=require("./OrganizationFinanceService");

const MAX_DOCUMENTS=10000;
const MAX_PROJECTS=200;
const MAX_INVESTMENTS=150;

function amountToCents(value){
 if(value===null||value===undefined)return null;
 const found=/^(-?)(\d{1,16})(?:\.(\d{1,2}))?$/.exec(String(value).trim());
 if(!found)return null;
 const amount=BigInt(found[2])*100n+BigInt((found[3]||"").padEnd(2,"0")||"0");
 return found[1]==="-"?-amount:amount;
}
function toMoney(value){
 const negative=value<0n,positive=negative?-value:value;
 return (negative?"-":"")+(positive/100n).toString()+"."+
  (positive%100n).toString().padStart(2,"0");
}
function normalizeProjectName(value){
 return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .replace(/ł/gi,match=>match==="Ł"?"L":"l")
  .replace(/[^a-z0-9]+/gi," ").trim().toLowerCase().replace(/\s+/g," ");
}
function createBucket(currency,direction,month=null){
 return {currency,direction,month,count:0,
  net:0n,vat:0n,gross:0n,
  missingNet:0,missingVat:0,missingGross:0};
}
function accumulate(bucket,document){
 bucket.count++;
 for(const [field,missing] of [["netAmount","missingNet"],["vatAmount","missingVat"],["grossAmount","missingGross"]]){
  const cents=amountToCents(document[field]);
  if(cents===null)bucket[missing]++;
  else bucket[field==="netAmount"?"net":field==="vatAmount"?"vat":"gross"]+=cents;
 }
}
function publishBucket(bucket){
 return {
  currency:bucket.currency,direction:bucket.direction,
  ...(bucket.month!==null?{month:bucket.month}:{}),
  count:bucket.count,
  net:bucket.missingNet?null:toMoney(bucket.net),
  vat:bucket.missingVat?null:toMoney(bucket.vat),
  gross:bucket.missingGross?null:toMoney(bucket.gross),
  missingNet:bucket.missingNet,
  missingVat:bucket.missingVat,
  missingGross:bucket.missingGross
 };
}
function assignedCompanyDirection(document,nip){
 const buyer=String(document.buyerNip||"")===nip;
 const seller=String(document.sellerNip||"")===nip;
 if(buyer===seller)return false;
 return (buyer&&document.direction==="INCOMING")||
  (seller&&document.direction==="OUTGOING");
}
function correctionProject(organizationId){
 return {select:{organizationId:true,invoice:{select:{projectId:true}}},
  where:{organizationId}};
}
function effectiveProject({correctionLink,...document},organizationId){
 return {...document,projectId:correctionLink?.organizationId===organizationId
  ? correctionLink.invoice.projectId : document.projectId};
}
function reportForProjects({investments,projects,documents,nip,year,organizationId}){
 const normalized=new Map();
 for(const project of projects){
  const key=normalizeProjectName(project.name);
  const list=normalized.get(key)||[];
  list.push(project);
  normalized.set(key,list);
 }
 // A company investment is never linked by substring or fuzzy matching:
 // overlapping Mielno/Zgorzelec names must not assign expenses incorrectly.
 const claimed=new Map();
 const result=investments.map(investment=>{
  const candidate=normalized.get(normalizeProjectName(investment.name))||[];
  const unique=candidate.length===1?candidate[0]:null;
  if(unique)claimed.set(unique.id,(claimed.get(unique.id)||0)+1);
  return {id:investment.id,name:investment.name,status:investment.status,
   progress:investment.progress,legacyProjectId:unique?.id||null,
   accountMapping:unique?"EXACT_NAME":"UNLINKED",totals:[],months:[],documents:0};
 });
 // An old accounting project cannot be assigned to two different
 // organization investment rows, even if both somehow normalize identically.
 for(const entry of result){
  if(entry.legacyProjectId&&claimed.get(entry.legacyProjectId)!==1){
   entry.legacyProjectId=null;
   entry.accountMapping="AMBIGUOUS";
  }
 }
 const orgByProject=new Map(result.filter(x=>x.legacyProjectId).map(x=>[x.legacyProjectId,x]));
 const allowed=new Map(projects.map(p=>[p.id,p]));
 const legacy=projects.filter(x=>!orgByProject.has(x.id)).map(project=>({
  id:project.id,name:project.name,legacyProjectId:project.id,
  accountMapping:"ONLY_KSEF",status:null,progress:null,totals:[],months:[],documents:0
 }));
 const reportRows=[...result,...legacy];
 const byProject=new Map(reportRows.filter(x=>x.legacyProjectId).map(x=>[x.legacyProjectId,x]));
 let unassigned=0,otherProject=0,rejectedDirection=0,accepted=0,missingIssueDate=0;
 for(const doc of documents){
  if(!assignedCompanyDirection(doc,nip)){rejectedDirection++;continue;}
  if(!doc.issueDate||!Number.isFinite(new Date(doc.issueDate).getTime())){missingIssueDate++;continue;}
  const month=new Date(doc.issueDate).getUTCMonth()+1;
  const target=doc.projectId?byProject.get(doc.projectId):null;
  if(!target){
   if(!doc.projectId)unassigned++;
   else otherProject++;
   continue;
  }
  if(!allowed.has(doc.projectId)){otherProject++;continue;}
  const currency=String(doc.currency||"").toUpperCase();
  if(!/^[A-Z]{3}$/.test(currency)){otherProject++;continue;}
  accepted++;
  target.documents++;
  const totalKey=currency+"|"+doc.direction;
  const monthKey=totalKey+"|"+month;
  if(!target._totals)target._totals=new Map();
  if(!target._months)target._months=new Map();
  if(!target._totals.has(totalKey))target._totals.set(totalKey,createBucket(currency,doc.direction));
  if(!target._months.has(monthKey))target._months.set(monthKey,createBucket(currency,doc.direction,month));
  accumulate(target._totals.get(totalKey),doc);
  accumulate(target._months.get(monthKey),doc);
 }
 for(const entry of reportRows){
  entry.totals=[...(entry._totals?.values()||[])].map(publishBucket).sort((a,b)=>
   a.currency.localeCompare(b.currency)||a.direction.localeCompare(b.direction));
  entry.months=[...(entry._months?.values()||[])].map(publishBucket).sort((a,b)=>
   a.month-b.month||a.currency.localeCompare(b.currency)||a.direction.localeCompare(b.direction));
  entry.profitability=[...new Set(entry.totals.map(row=>row.currency))].map(currency=>{
   const revenue=entry.totals.find(row=>row.currency===currency&&row.direction==="OUTGOING");
   const cost=entry.totals.find(row=>row.currency===currency&&row.direction==="INCOMING");
   const complete=(!revenue||revenue.net!==null)&&(!cost||cost.net!==null);
   const sales=amountToCents(revenue?.net)||0n,expenses=amountToCents(cost?.net)||0n;
   return {currency,netSales:revenue?revenue.net:"0.00",netCosts:cost?cost.net:"0.00",
    netResult:complete?toMoney(sales-expenses):null,
    marginPercent:complete&&sales>0n?toMoney((sales-expenses)*10000n/sales):null};
  });
  delete entry._totals;delete entry._months;
 }
 return {organizationId,year,source:"KSEF_PROJECT_ASSIGNMENTS",
  investments:result,otherKsefProjects:legacy,
  counts:{matchedInvoices:accepted,unassignedInvoices:unassigned,
   otherProjectAssignments:otherProject,rejectedDirection,missingIssueDate},
  note:"Koszty to faktury zakupowe KSeF przypisane do projektów. Nie są potwierdzeniem zapłaty ani pełnym kosztorysem inwestycji. Sprzedaż i zakup pokazane oddzielnie; waluty nie są sumowane."};
}
class OrganizationInvestmentFinanceService{
 constructor({db=prisma,finance=null}={}){
  this.db=db;this.finance=finance||new OrganizationFinanceService({db});
 }
 async catalog(userId,organizationId){
  const {items:projects}=await this.finance.projects(userId,organizationId);
  const investments=await this.db.organizationInvestment.findMany({
   where:{organizationId},select:{id:true,name:true,status:true,progress:true,assignedUserIds:true},
   take:MAX_INVESTMENTS+1
  });
  if(projects.length>=MAX_PROJECTS||investments.length>MAX_INVESTMENTS)
   throw new OrganizationError("Katalog jest zbyt duży do jednoznacznego powiązania z KSeF.",413);
  return {investments,projects};
 }
 async visibleProjects(userId,organizationId,role){
  if(["OWNER","ADMIN"].includes(role))return null;
  const {investments,projects}=await this.catalog(userId,organizationId);
  const assigned=new Set(investments.filter(row=>row.assignedUserIds.includes(userId)).map(row=>row.id));
  const mapping=reportForProjects({investments,projects,documents:[]});
  const allowed=new Set(mapping.investments.filter(row=>assigned.has(row.id)).map(row=>row.legacyProjectId));
  return projects.filter(project=>allowed.has(project.id));
 }
 async forInvestment(userId,organizationId,investment,yearInput,offsetInput){
  const year=Number(yearInput);
  const offset=Number(offsetInput ?? 0);
  if(!Number.isInteger(year)||year<2020||year>2100||
     !Number.isInteger(offset)||offset<0||offset>=MAX_DOCUMENTS)
   throw new OrganizationError("Nieprawidłowy rok lub przesunięcie faktur.",400);
  const link=await this.finance.accessible(userId,organizationId);
  const {investments,projects}=await this.catalog(userId,organizationId);

  const reportInput={organizationId,year,investments,projects,nip:link.nip};
  const mapping=reportForProjects({...reportInput,documents:[]}).investments.find(row=>row.id===investment.id);
  if(!mapping?.legacyProjectId)
   return {year,mapping:mapping?.accountMapping||"UNLINKED",totals:[],months:[],invoices:[],nextOffset:null};

  const documents=await this.db.financialDocument.findMany({
   where:{
    ...ksefDocPredicate(link.ownerUserId,link.nip),
    issueDate:{gte:new Date(Date.UTC(year,0,1)),lt:new Date(Date.UTC(year+1,0))},
    AND:[{OR:[
     {projectId:mapping.legacyProjectId},
     {correctionLink:{organizationId,invoice:{projectId:mapping.legacyProjectId}}}
    ]},{OR:[
     {direction:"INCOMING",buyerNip:link.nip,OR:[{sellerNip:null},{sellerNip:{not:link.nip}}]},
     {direction:"OUTGOING",sellerNip:link.nip,OR:[{buyerNip:null},{buyerNip:{not:link.nip}}]}
    ]}]
   },
   select:{id:true,invoiceNumber:true,projectId:true,issueDate:true,direction:true,
    correctionLink:correctionProject(organizationId),
    sellerNip:true,buyerNip:true,currency:true,netAmount:true,vatAmount:true,grossAmount:true},
   orderBy:[{issueDate:"desc"},{id:"desc"}],take:MAX_DOCUMENTS+1
  });
  if(documents.length>MAX_DOCUMENTS)
   throw new OrganizationError("Za dużo faktur w wybranym roku.",413);

  const eligible=documents.map(doc=>effectiveProject(doc,organizationId)).filter(doc=>
   doc.projectId===mapping.legacyProjectId&&assignedCompanyDirection(doc,link.nip)&&/^[A-Z]{3}$/.test(doc.currency.toUpperCase()));
  const row=reportForProjects({...reportInput,documents:eligible}).investments.find(item=>item.id===investment.id);
  const invoices=eligible.slice(offset,offset+50).map(({id,invoiceNumber,issueDate,direction,currency,grossAmount})=>({
   id,invoiceNumber,issueDate,direction,currency:currency.toUpperCase(),grossAmount
  }));
  return {year,mapping:row.accountMapping,totals:row.totals,months:row.months,profitability:row.profitability,invoices,
   nextOffset:offset+50<eligible.length?offset+50:null};
 }
 async report(userId,organizationId,yearInput,member=null){
  // The organization’s finance permission is checked before fetching
  // its accounting project catalog, invoices or investment names.
  const link=await this.finance.accessible(userId,organizationId);
  const year=Number(yearInput);
  if(!Number.isInteger(year)||year<2020||year>2100)
   throw new OrganizationError("Nieprawidłowy rok raportu inwestycji.",400);
  const catalog=await this.finance.projects(userId,organizationId);
  const projects=catalog.items||[];
  if(projects.length>=MAX_PROJECTS)
   throw new OrganizationError("Za dużo projektów KSeF do jednoznacznego raportu.",413);
  const investments=await this.db.organizationInvestment.findMany({
   where:{organizationId},select:{id:true,name:true,status:true,progress:true,assignedUserIds:true},
   orderBy:[{name:"asc"},{id:"asc"}],take:MAX_INVESTMENTS+1
  });
  if(investments.length>MAX_INVESTMENTS)
   throw new OrganizationError("Za dużo inwestycji do jednego raportu.",413);
  const documents=await this.db.financialDocument.findMany({
   where:{AND:[ksefDocPredicate(link.ownerUserId,link.nip),
    {issueDate:{gte:new Date(Date.UTC(year,0,1)),lt:new Date(Date.UTC(year+1,0))}}],
    direction:{in:["INCOMING","OUTGOING"]}},
   select:{id:true,source:true,userId:true,projectId:true,issueDate:true,direction:true,
    correctionLink:correctionProject(organizationId),
    sellerNip:true,buyerNip:true,currency:true,netAmount:true,vatAmount:true,grossAmount:true},
   orderBy:[{issueDate:"asc"},{id:"asc"}],take:MAX_DOCUMENTS+1
  });
  if(documents.length>MAX_DOCUMENTS)
   throw new OrganizationError("Za dużo faktur do jednego raportu. Zawęź zakres roku.",413);
  const report=reportForProjects({organizationId,year,investments,projects,
   documents:documents.map(doc=>effectiveProject(doc,organizationId)),nip:link.nip});
  if(!member||["OWNER","ADMIN"].includes(member.role))return report;
  const assigned=new Set(investments.filter(item=>item.assignedUserIds.includes(userId)).map(item=>item.id));
  const visible=report.investments.filter(item=>assigned.has(item.id));
  return {...report,investments:visible,otherKsefProjects:[],
   counts:{matchedInvoices:visible.reduce((sum,item)=>sum+item.documents,0)}};

 }
}
module.exports={OrganizationInvestmentFinanceService,reportForProjects,
 amountToCents,toMoney,normalizeProjectName,assignedCompanyDirection};
