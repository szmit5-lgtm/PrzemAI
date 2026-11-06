"use strict";

const express = require("express");
const prisma = require("../../lib/prisma");
const verifyToken = require("../middleware/verifyToken");
const {OrganizationService,OrganizationError}=require("../services/OrganizationService");
const service=new OrganizationService();

const router = express.Router();

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
router.get("/:id",verifyToken,handler(req=>service.details(req.user.id,req.params.id)));
router.patch("/:id/branding",verifyToken,
  handler(req=>service.changeBranding(req.user.id,req.params.id,req.body)));
router.get("/:id/members",verifyToken,handler(req=>service.members(req.user.id,req.params.id)));
router.post("/:id/invitations",verifyToken,
  handler(req=>service.invite(req.user.id,req.params.id,req.body)));
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

module.exports = router;
