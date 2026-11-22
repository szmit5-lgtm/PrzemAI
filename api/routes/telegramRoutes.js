"use strict";
const express = require("express");
const verifyToken = require("../middleware/verifyToken");
const {createLink,handleCommand,sendTelegramMessage,validWebhookSecret} =
  require("../services/TelegramBridgeService");
const router=express.Router();

// Deliberately not active until TELEGRAM_WEBHOOK_SECRET is configured
// and the same secret is registered with Telegram setWebhook.
router.post("/webhook",async(req,res)=>{
  if(!validWebhookSecret(req.get("X-Telegram-Bot-Api-Secret-Token")))
    return res.status(403).json({success:false});
  try {
    const answer=await handleCommand({update:req.body});
    if(answer) await sendTelegramMessage(answer);
    return res.sendStatus(200);
  } catch(error) {
    console.error("[TelegramBridge] Incoming update failed",error?.name||"Error");
    return res.sendStatus(503);
  }
});
router.post("/link-code",verifyToken,async(req,res)=>{
  try {
    const data=await createLink({userId:req.user?.id});
    return res.status(201).json({success:true,data});
  } catch(error) {
    console.error("[TelegramBridge] Pairing failed",error?.name||"Error");
    return res.status(503).json({success:false,error:"Nie mozna utworzyc kodu."});
  }
});
module.exports=router;
