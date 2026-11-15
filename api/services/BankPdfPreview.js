"use strict";

const MAX_PAGES = 150;
const MAX_LINES = 15000;

// Authorization runs before buffering the upload or invoking the PDF parser.
function createBankPdfPreviewHandler({financeService, prisma, upload, parsePdf, OrganizationError}) {
 return async function bankPdfPreview(req, res) {
  try {
   await financeService.accessible(req.user.id, req.params.id);
   const membership = await prisma.organizationMembership.findFirst({where:{
    userId:req.user.id, organizationId:req.params.id, status:"ACTIVE", role:"OWNER"
   }});
   if (!membership) return res.status(403).json({success:false,error:"Import wymaga roli właściciela."});
  } catch (error) {
   const status = error instanceof OrganizationError ? error.status || 403 : 500;
   return res.status(status).json({success:false,error:status===500
    ? "Nie udało się sprawdzić dostępu do finansów." : "Brak dostępu do finansów tej firmy."});
  }
  return upload(req,res,async error=>{
   if(error)return res.status(400).json({success:false,error:"PDF jest za duży lub nieprawidłowy (limit 15 MB)."});
   if(!req.file)return res.status(400).json({success:false,error:"Wybierz plik PDF."});
   if(req.file.buffer.subarray(0,5).toString()!=="%PDF-")return res.status(400).json({success:false,error:"Plik nie jest dokumentem PDF."});
   try {
    const parsed = await parsePdf(req.file.buffer,{max:MAX_PAGES});
    // pdf-parse can return the total page count while extracting only `max` pages.
    // Never present a partial financial statement as a complete preview.
    if(!Number.isInteger(parsed.numpages)||parsed.numpages<1||parsed.numpages>MAX_PAGES)
     return res.status(422).json({success:false,error:"PDF musi zawierać od 1 do 150 stron. Podziel dłuższy dokument na kompletne wyciągi."});
    const source=String(parsed.text||"");
    const lines=source.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    if(lines.length>MAX_LINES)return res.status(422).json({success:false,error:"PDF przekracza limit 15000 wierszy. Podziel dokument na kompletne wyciągi."});
    if(!lines.length)return res.status(422).json({success:false,error:"PDF nie zawiera tekstu. Skan wymaga OCR i ręcznej weryfikacji."});
    const statementNumbers=Array.from(new Set((source.match(/\b\d{4}\s*\/\s*\d{1,5}\b/g)||[]).map(v=>v.replace(/\s/g,"")))).slice(0,50);
    const accountNumbers=Array.from(new Set((source.match(/(?:PL\s*)?(?:\d[\s-]*){26}/g)||[]).map(v=>v.replace(/[\s-]/g,"")).filter(v=>/^(?:PL)?\d{26}$/.test(v)))).slice(0,50);
    return res.json({success:true,data:{pages:parsed.numpages,lines,statementNumbers,accountNumbers,
     requiresReview:true,warning:"Wykryto "+statementNumbers.length+" numerów wyciągów i "+accountNumbers.length+" rachunków. Automatyczny zapis jest zablokowany do czasu zgodności liczby operacji i sald każdego wyciągu."}});
   } catch (_) {
    return res.status(422).json({success:false,error:"Nie udało się odczytać PDF. Sprawdź format i zabezpieczenia dokumentu."});
   }
  });
 };
}

module.exports={createBankPdfPreviewHandler};
