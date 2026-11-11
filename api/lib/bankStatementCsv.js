"use strict";
// Pure CSV preview parser. No persistence, no account credentials and no automatic matching.
function parseCsvRows(text,delimiter=";"){
 if(![";",","].includes(delimiter))throw new Error("Unsupported CSV delimiter");
 const rows=[];let row=[],cell="",quoted=false;
 const input=String(text||"").replace(/^\uFEFF/,"");
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(ch==='"'){
   if(quoted&&input[i+1]==='"'){cell+='"';i++;}
   else if(!quoted&&cell==="")quoted=true;
   else if(quoted)quoted=false;
   else throw new Error("Invalid CSV quote");
  }else if(ch===delimiter&&!quoted){row.push(cell);cell="";}
  else if((ch==="\n"||ch==="\r")&&!quoted){
   if(ch==="\r"&&input[i+1]==="\n")i++;
   row.push(cell);if(row.some(v=>v.trim()!==""))rows.push(row);
   row=[];cell="";
  }else cell+=ch;
 }
 if(quoted)throw new Error("Unclosed CSV quote");
 row.push(cell);if(row.some(v=>v.trim()!==""))rows.push(row);
 if(rows.length>1){const width=rows[0].length;if(rows.some(r=>r.length!==width))throw new Error("Inconsistent CSV columns");}
 return rows;
}
function parsePolishAmount(value){
 const raw=String(value??"").replace(/\u00a0/g," ").trim().replace(/\s/g,"");
 if(!/^-?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d{1,2})?$/.test(raw)&&
    !/^-?\d+(?:\.\d{1,2})?$/.test(raw))throw new Error("Invalid amount");
 const normalized=raw.includes(",")?raw.replace(/\./g,"").replace(",","."):raw;
 const amount=Number(normalized);
 if(!Number.isFinite(amount))throw new Error("Invalid amount");
 return Math.round(amount*100);
}
module.exports={parseCsvRows,parsePolishAmount};
