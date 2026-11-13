"use strict";

const express = require("express");
const prisma = require("../../lib/prisma");
const verifyToken = require("../middleware/verifyToken");
const {OrganizationService,OrganizationError}=require("../services/OrganizationService");
const service=new OrganizationService();
const {OrganizationFinanceService}=require("../services/OrganizationFinanceService");
const financeService=new OrganizationFinanceService();

const router = express.Router();

router.get("/:id/bank/summary", verifyToken, async (req,res)=>{
 try{
  const membership=await prisma.organizationMembership.findFirst({
   where:{userId:req.user.id,organizationId:req.params.id,status:"ACTIVE",
    organization:{status:"ACTIVE"}},
   select:{role:true,financeAccess:true}
  });
  if(!membership)return res.status(403).json({success:false,error:"Brak dostępu do firmy."});
  if(membership.role!=="OWNER"&&!membership.financeAccess)
   return res.status(403).json({success:false,error:"Nie masz dostępu do finansów tej firmy."});
  const accounts=await prisma.bankAccount.findMany({
   where:{organizationId:req.params.id},
   select:{id:true,label:true,accountType:true,currency:true,iban:true,
    statements:{orderBy:[{periodEnd:"desc"},{importedAt:"desc"}],take:1,
     select:{closingBalance:true,periodEnd:true,statementNumber:true}}}
  });
  return res.json({success:true,data:{accounts:accounts.map(a=>({
   id:a.id,label:a.label,accountType:a.accountType,currency:a.currency,
   ibanSuffix:a.iban.slice(-4),
   balance:a.statements[0]?.closingBalance?.toString()??null,
   balanceDate:a.statements[0]?.periodEnd??null,
   statementNumber:a.statements[0]?.statementNumber??null
  }))}});
 }catch(error){
  const code=error instanceof OrganizationError?error.status||403:500;
  return res.status(code).json({success:false,error:code===500?"Nie udało się pobrać sald.":error.message});
 }
});


// Company records are created only by authenticated users. This does not
// grant access to another user's tasks, invoices, KSeF or bank connections.
router.get("/", verifyToken, async (req, res) => {
  try {
    const memberships = await prisma.organizationMembership.findMany({
      where: { userId: req.user.id, status: "ACTIVE" },
      include: { organization: { include: { domains: { select: {
        hostname: true, verifiedAt: true, isPrimary: true
      } } } } },
      orderBy: { createdAt: "asc" }
    });
    res.json({ success: true, data: memberships.map(({ role, organization }) => ({ role, ...organization })) });
  } catch {
    res.status(500).json({ success: false, error: "Nie udało się pobrać kont firmowych." });
  }
});


const { hashPassword } = require("../../lib/hash");

// Registration is gated by the same server setting as individual signup.
// The new owner, company and membership are written in one transaction.
router.post("/register", async (req, res) => {
  if (process.env.ALLOW_PUBLIC_REGISTRATION === "false") {
    return res.status(403).json({ success: false, error: "Rejestracja jest obecnie wyłączona." });
  }
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const slug = typeof req.body?.slug === "string" ? req.body.slug.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
      typeof password !== "string" || password.length < 8 || password.length > 1024 ||
      name.length < 2 || name.length > 120 ||
      !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug)) {
    return res.status(400).json({ success: false, error: "Sprawdź nazwę firmy, identyfikator, e-mail i hasło (min. 8 znaków)." });
  }
  try {
    const passwordHash = await hashPassword(password);
    const result = await prisma.$transaction(async tx => {
      const user = await tx.user.create({
        data: { email, password: passwordHash, role: "user" },
        select: { id: true, email: true, role: true }
      });
      const organization = await tx.organization.create({
        data: { name, slug, displayName: name, memberships: {
          create: { userId: user.id, role: "OWNER" }
        } },
        select: { id: true, name: true, slug: true }
      });
      return { user, organization };
    });
    return res.status(201).json({ success: true, ...result });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ success: false, error: "Ten adres e-mail lub identyfikator firmy jest już zajęty." });
    }
    return res.status(500).json({ success: false, error: "Nie udało się utworzyć konta firmowego." });
  }
});


// All company endpoints validate the logged-in user's membership in the service.
// An organization ID or browser-selected company is never a security credential.
const handler=fn=>async(req,res)=>{
  try{
    const data=await fn(req);
    res.json({success:true,data});
  }catch(error){
    if(error?.code==="P2002")return res.status(409).json({
      success:false,error:"Ten adres domeny lub identyfikator jest już zajęty."
    });
    const status=error instanceof OrganizationError ? error.status : 500;
    res.status(status).json({success:false,error:status===500
      ?"Nie udało się wykonać operacji firmowej.":error.message});
  }
};
router.get("/invitations",verifyToken,handler(req=>service.pendingInvites(req.user.id)));
router.post("/:id/invitations/accept",verifyToken,
  handler(req=>service.acceptInvite(req.user.id,req.params.id)));
router.get("/:id/finance/status",verifyToken,
  handler(req=>financeService.linkStatus(req.user.id,req.params.id)));
router.post("/:id/finance/link",verifyToken,
  handler(req=>financeService.linkPilot(req.user.id,req.params.id)));
router.get("/:id/finance/summary",verifyToken,
  handler(req=>financeService.summary(req.user.id,req.params.id)));
router.get("/:id/finance/documents",verifyToken,
  handler(req=>financeService.documents(req.user.id,req.params.id,req.query)));
router.get("/:id/finance/projects",verifyToken,
  handler(req=>financeService.projects(req.user.id,req.params.id)));
router.get("/:id/finance/members",verifyToken,
  handler(req=>financeService.members(req.user.id,req.params.id)));
router.patch("/:id/finance/members/:membershipId",verifyToken,
  handler(req=>financeService.setPermission(req.user.id,req.params.id,
    req.params.membershipId,req.body?.financeAccess)));

router.get("/:id",verifyToken,handler(req=>service.details(req.user.id,req.params.id)));
router.patch("/:id/branding",verifyToken,
  handler(req=>service.changeBranding(req.user.id,req.params.id,req.body)));
router.get("/:id/members",verifyToken,handler(req=>service.members(req.user.id,req.params.id)));
router.post("/:id/invitations",verifyToken,
  handler(req=>service.invite(req.user.id,req.params.id,req.body)));
router.post("/:id/members/:membershipId/activate",verifyToken,
  handler(req=>service.activateMember(req.user.id,req.params.id,req.params.membershipId)));
router.delete("/:id/members/:membershipId",verifyToken,
  handler(req=>service.revoke(req.user.id,req.params.id,req.params.membershipId)));
router.post("/:id/domains",verifyToken,
  handler(req=>service.requestDomain(req.user.id,req.params.id,req.body)));
router.get("/:id/domains/:domainId",verifyToken,
  handler(req=>service.domainInstructions(req.user.id,req.params.id,req.params.domainId)));
router.post("/:id/domains/:domainId/verify",verifyToken,
  handler(req=>service.verifyDomain(req.user.id,req.params.id,req.params.domainId)));
router.get("/:id/workspace",verifyToken,handler(req=>service.workspace(req.user.id,req.params.id)));
router.post("/:id/workspace/tasks",verifyToken,
  handler(req=>service.createCompanyTask(req.user.id,req.params.id,req.body)));
router.patch("/:id/workspace/tasks/:taskId",verifyToken,
  handler(req=>service.setCompanyTaskStatus(req.user.id,req.params.id,req.params.taskId,
    req.body?.status)));

router.post("/", verifyToken, async (req, res) => {
  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const slug = typeof req.body?.slug === "string" ? req.body.slug.trim().toLowerCase() : "";
  if (name.length < 2 || name.length > 120 ||
      !/^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug)) {
    return res.status(400).json({ success: false, error: "Podaj nazwę firmy i identyfikator (3–40 małych liter, cyfr lub łączników)." });
  }
  try {
    const organization = await prisma.organization.create({
      data: {
        name,
        slug,
        displayName: name,
        memberships: { create: { userId: req.user.id, role: "OWNER" } }
      },
      select: { id: true, name: true, slug: true, displayName: true, status: true }
    });
    res.status(201).json({ success: true, data: organization });
  } catch (error) {
    if (error?.code === "P2002") {
      return res.status(409).json({ success: false, error: "Ten identyfikator firmy jest już zajęty." });
    }
    res.status(500).json({ success: false, error: "Nie udało się utworzyć konta firmowego." });
  }
});


const {importStatement}=require("../services/BankStatementImportService");
router.post("/:id/bank/statements",verifyToken,async(req,res)=>{
 try{
  const data=await importStatement(req.user.id,req.params.id,req.body);
  return res.status(201).json({success:true,data});
 }catch(error){
  const status=error instanceof OrganizationError?error.status||403:
   error?.code==="P2002"?409:
   /Nieprawidłowa|Podaj |Saldo |Data musi|Wyciąg /.test(error?.message||"")?400:500;
  return res.status(status).json({success:false,error:status===500?
   "Nie udało się zaimportować wyciągu.":error.message});
 }
});
router.get("/:id/bank/statements",verifyToken,async(req,res)=>{
 try{
  await financeService.accessible(req.user.id,req.params.id);
  const data=await prisma.bankStatement.findMany({where:{organizationId:req.params.id},
   orderBy:{periodEnd:"desc"},take:50,
   select:{id:true,statementNumber:true,periodEnd:true,openingBalance:true,closingBalance:true,transactionCount:true,
    bankAccount:{select:{label:true,iban:true}}}});
  return res.json({success:true,data:data.map(x=>({...x,openingBalance:x.openingBalance.toString(),
   closingBalance:x.closingBalance.toString(),bankAccount:{label:x.bankAccount.label,ibanSuffix:x.bankAccount.iban.slice(-4)}}))});
 }catch(error){
  const status=error instanceof OrganizationError?error.status||403:500;
  return res.status(status).json({success:false,error:status===500?"Nie udało się pobrać wyciągów.":error.message});
 }
});


const multer = require("multer");
const pdfParse = require("pdf-parse");
const bankPdfUpload = multer({
 storage: multer.memoryStorage(),
 limits: { fileSize: 15 * 1024 * 1024, files: 1 },
 fileFilter: (_req,file,cb) => cb(null, file.mimetype === "application/pdf" || /\.pdf$/i.test(file.originalname))
});
router.post("/:id/bank/pdf-preview",verifyToken,(req,res)=>{
 bankPdfUpload.single("file")(req,res,async error=>{
  if(error)return res.status(400).json({success:false,error:"PDF jest za duży lub nieprawidłowy (limit 15 MB)."});
  if(!req.file)return res.status(400).json({success:false,error:"Wybierz plik PDF."});
  try{
   await financeService.accessible(req.user.id,req.params.id);
   const membership=await prisma.organizationMembership.findFirst({where:{userId:req.user.id,organizationId:req.params.id,status:"ACTIVE",role:"OWNER"}});
   if(!membership)return res.status(403).json({success:false,error:"Import wymaga roli właściciela."});
   if(req.file.buffer.subarray(0,5).toString()!=="%PDF-")return res.status(400).json({success:false,error:"Plik nie jest dokumentem PDF."});
   const parsed=await pdfParse(req.file.buffer,{max:150});
   const lines=String(parsed.text||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).slice(0,15000);
   if(!lines.length)return res.status(422).json({success:false,error:"PDF nie zawiera tekstu. Skan wymaga OCR i ręcznej weryfikacji."});
   const source=String(parsed.text||"");
   // Preview only: extract candidates without writing any financial records.
   const statementNumbers=[...new Set([...source.matchAll(/(?:nr\\s*(?:wyci[aą]gu)?|wyci[aą]g\\s*(?:nr)?)\\s*[:#-]?\\s*(\\d{4}\\s*\\/\\s*\\d{1,5})/gi)].map(m=>m[1].replace(/\\s/g,""))].slice(0,50);
   const accountNumbers=[...new Set([...source.matchAll(/(?:PL\\s*)?(?:\\d[\\s-]*){26}/g)].map(m=>m[0].replace(/[\\s-]/g,"")).filter(v=>/^(?:PL)?\\d{26}$/.test(v)))].slice(0,50);
   return res.json({success:true,data:{pages:parsed.numpages,lines,statementNumbers,accountNumbers,
    requiresReview:true,warning:"Wykryto "+statementNumbers.length+" numerów wyciągów i "+accountNumbers.length+" rachunków. Automatyczny zapis jest zablokowany do czasu zgodności liczby operacji i sald każdego wyciągu."}});
  }catch(e){return res.status(422).json({success:false,error:"Nie udało się odczytać PDF. Sprawdź format i zabezpieczenia dokumentu."});}
 });
});

module.exports = router;
