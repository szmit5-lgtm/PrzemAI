"use strict";
const express=require("express");
const multer=require("multer");
const path=require("node:path");
const {BankFileUploadService}=require("../services/BankFileUploadService");
const {OrganizationBankAccessService}=require("../services/OrganizationBankAccessService");
const {OrganizationError}=require("../services/OrganizationService");

const router=express.Router({mergeParams:true});
const service=new BankFileUploadService();
const bankAccess=new OrganizationBankAccessService();
const maximum=15*1024*1024;
const upload=multer({
 storage:multer.memoryStorage(),
 limits:{fileSize:maximum,files:1},
 fileFilter:(_req,file,callback)=>{
  const ext=path.extname(file.originalname||"").toLowerCase();
  if(![".pdf",".csv"].includes(ext))
   return callback(Object.assign(new Error("Obsługujemy wyłącznie CSV i PDF."),{code:"BANK_FILE_TYPE"}));
  callback(null,true);
 }
}).single("file");

// Deny before allocating memory to receive a financial document.
router.use(async(req,res,next)=>{
 try{await bankAccess.authorize(req.user?.id,req.params.id,{ownerOnly:true});next();}
 catch(error){
  const status=error instanceof OrganizationError?(error.status||403):500;
  res.status(status).json({success:false,error:status===500?
   "Nie udało się potwierdzić uprawnień bankowych.":error.message});
 }
});

router.get("/",async(req,res)=>{
 try{
  const data=await service.list(req.user.id,req.params.id);
  return res.json({success:true,...data});
 }catch(error){
  const status=error instanceof OrganizationError?(error.status||403):500;
  return res.status(status).json({success:false,error:status===500?
   "Nie udało się pobrać plików bankowych.":error.message});
 }
});
router.post("/",(req,res)=>upload(req,res,async uploadError=>{
 if(uploadError)return res.status(400).json({success:false,error:
  uploadError.code==="LIMIT_FILE_SIZE"?"Wyciąg jest zbyt duży (maksymalnie 15 MB).":
  uploadError.code==="BANK_FILE_TYPE"?uploadError.message:"Nie udało się wczytać pliku."});
 if(!req.file)return res.status(400).json({success:false,error:"Wybierz plik CSV lub PDF."});
 try{
  const data=await service.upload(req.user.id,req.params.id,req.file);
  return res.status(data.alreadySaved?200:201).json({success:true,...data});
 }catch(error){
  const status=error instanceof OrganizationError?(error.status||400):500;
  return res.status(status).json({success:false,error:status===500?
   "Nie udało się zapisać wyciągu. Spróbuj ponownie.":error.message});
 }
}));
router.get("/:fileId/download",async(req,res)=>{
 try{
  const item=await service.download(req.user.id,req.params.id,req.params.fileId);
  const filename=String(item.name).replace(/[^a-z0-9._-]/gi,"_").slice(0,120)||"wyciag";
  res.set({
   "Content-Type":"application/octet-stream",
   "Content-Disposition":'attachment; filename="'+filename+'"; filename*=UTF-8\'\''+encodeURIComponent(item.name),
   "X-Content-Type-Options":"nosniff",
   "Cache-Control":"private, no-store"
  });
  return res.send(Buffer.from(item.content));
 }catch(error){
  const status=error instanceof OrganizationError?(error.status||404):500;
  return res.status(status).json({success:false,error:status===500?
   "Nie udało się pobrać pliku bankowego.":error.message});
 }
});
module.exports=router;
