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
      select:{id:true,role:true}
    });
    if (!user || user.role !== "admin")
      return res.status(403).json({success:false,error:"Brak uprawnień administratora systemu."});
    next();
  } catch {
    res.status(500).json({success:false,error:"Nie można sprawdzić uprawnień."});
  }
});

router.get("/users", async (req,res) => {
  try {
    const limit = 50;
    const cursor = typeof req.query.cursor === "string" && req.query.cursor.length < 100
      ? req.query.cursor : null;
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

module.exports = router;
