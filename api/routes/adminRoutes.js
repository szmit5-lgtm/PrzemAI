"use strict";
const express = require("express");
const prisma = require("../../lib/prisma");
const verifyToken = require("../middleware/verifyToken");
const router = express.Router();

// IMPORTANT: Never trust a JWT role, email suffix, or user-supplied flag.
// Only a privileged DB role can enumerate unrelated registered accounts.
router.use(verifyToken);
router.use(async (req,res,next) => {
  try {
    const user = await prisma.user.findUnique({
      where:{id:req.user.id},
      select:{id:true,role:true,email:true}
    });
    if (!user || user.role !== "admin" || user.email?.trim().toLowerCase() !== "p.szmitkowski@dekonica.com")
      return res.status(403).json({success:false,error:"Brak uprawnień administratora systemu."});
    next();
  } catch {
    res.status(500).json({success:false,error:"Nie można sprawdzić uprawnień."});
  }
});

router.get("/users", async (req,res) => {
  try {
    const limit = 50;
    if(req.query.cursor !== undefined && (typeof req.query.cursor !== "string" || !req.query.cursor.trim() || req.query.cursor.length >= 100))
      return res.status(400).json({success:false,error:"Nieprawidłowy kursor listy użytkowników."});
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor.trim() : null;
    const rows = await prisma.user.findMany({
      ...(cursor ? {cursor:{id:cursor},skip:1} : {}),
      take:limit+1,
      orderBy:[{createdAt:"desc"},{id:"desc"}],
      select:{
        id:true,email:true,role:true,createdAt:true,
        organizationMemberships:{
          where:{status:{in:["ACTIVE","PENDING"]}},
          select:{role:true,status:true,organization:{select:{id:true,name:true}}}
        }
      }
    });
    const nextCursor = rows.length > limit ? rows[limit-1].id : null;
    res.json({success:true,data:{items:rows.slice(0,limit),nextCursor}});
  } catch {
    res.status(500).json({success:false,error:"Nie udało się pobrać użytkowników."});
  }
});


const ADMIN_EMAIL = "p.szmitkowski@dekonica.com";
router.patch("/users/:id", async (req,res) => {
  const id=String(req.params.id||"");
  const email=typeof req.body?.email==="string"?req.body.email.trim().toLowerCase():"";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)
    return res.status(400).json({success:false,error:"Podaj poprawny adres e-mail."});
  if(email===ADMIN_EMAIL||id===req.user.id)
    return res.status(403).json({success:false,error:"Nie można edytować konta administratora systemu."});
  try{
    const target=await prisma.user.findUnique({where:{id},select:{id:true,role:true,email:true,createdAt:true}});
    if(!target)return res.status(404).json({success:false,error:"Nie znaleziono konta."});
    if(target.role==="admin"||target.email.toLowerCase()===ADMIN_EMAIL)
      return res.status(403).json({success:false,error:"Nie można edytować konta administratora."});
    if(typeof req.body?.expectedEmail !== "string" || req.body.expectedEmail.trim().toLowerCase() !== target.email.toLowerCase())
      return res.status(409).json({success:false,error:"Dane konta zmieniły się od otwarcia formularza. Odśwież listę."});
    const result=await prisma.user.updateMany({where:{id,role:{not:"admin"},email:target.email},data:{email}});
    if(result.count!==1)return res.status(409).json({success:false,error:"Konto zostało zmienione. Odśwież listę."});
    // The conditional write succeeded; avoid a second DB read that could fail after commit.
    return res.json({success:true,data:{id:target.id,email,role:target.role,createdAt:target.createdAt}});
  }catch(error){
    if(error?.code==="P2002")return res.status(409).json({success:false,error:"Ten adres e-mail jest już zajęty."});
    return res.status(500).json({success:false,error:"Nie udało się zapisać konta."});
  }
});

module.exports = router;
