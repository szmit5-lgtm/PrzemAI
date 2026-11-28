"use strict";

const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { promisify } = require("node:util");
const {parseErstePrintedCsv}=require("./ErsteStatementCsvParser");
const {parseAmount}=require("./BankFileParser");

const run = promisify(execFile);
const MAX_PAGES = 120;

async function readLayoutText(buffer) {
 const directory = await fs.mkdtemp(path.join(os.tmpdir(), "przemai-bank-pdf-"));
 try {
  const input = path.join(directory, "statement.pdf");
  await fs.writeFile(input, buffer, { mode: 0o600 });
  const { stdout } = await run("pdftotext", [
   "-f", "1", "-l", String(MAX_PAGES + 1), "-layout", "-enc", "UTF-8", input, "-"
  ], { timeout: 10000, maxBuffer: 4 * 1024 * 1024 });
  return stdout;
 } finally {
  await fs.rm(directory, { recursive: true, force: true });
 }
}

function layoutPages(text) {
 // Require Poppler's end-of-page markers to avoid treating a partial extract
 // as a complete statement. The extra requested page detects truncation.
 const pages = text.split("\f");
 if (pages.pop().trim() || !pages.length || pages.length > MAX_PAGES)
  throw Error("Nie odczytano wszystkich stron PDF.");
 return pages.map(page => page.split(/\r?\n/).map(line => line.trim()).join("\n"));
}

const amountPattern=/-?\d+(?:[ \u00a0\u202f]\d{3})*,\d{2}/g;
const datePattern=/\b\d{2}-\d{2}-20\d{2}\b/g;

async function renderPage(page) {
 const {items}=await page.getTextContent();
 const lines=[];
 for(const item of items){
  if(!item.str?.trim())continue;
  const [,,,,x,y]=item.transform;
  let line=lines.find(row=>Math.abs(row.y-y)<1);
  if(!line){line={y,items:[]};lines.push(line);}
  line.items.push({x,text:item.str.trim()});
 }
 return lines.sort((a,b)=>b.y-a.y).map(row=>row.items.sort((a,b)=>a.x-b.x)
  .map(item=>item.text).join(" ")).join("\n");
}

async function parseErsteStatementPdf(buffer,pdfParser,extractLayout = readLayoutText){
 let pages=[];
 try {
  const result=await pdfParser(buffer,{max:MAX_PAGES,pagerender:async page=>{
   pages.push(await renderPage(page));
   return "";
  }});
  if (result.numpages > MAX_PAGES) throw Error("Nie odczytano wszystkich stron PDF.");
  if (!pages.length || pages.length !== result.numpages) throw Error("Nie odczytano wszystkich stron PDF.");
 } catch {
  pages = layoutPages(await extractLayout(buffer));
 }
 const rows=[];
 const balances=new Map();
 const quote=row=>row.map(cell=>'"'+String(cell??"").replace(/"/g,'""')+'"').join(";");
 const push=(length,cells)=>{
  const row=Array(length).fill("");
  for(const [index,value] of Object.entries(cells))row[index]=value;
  rows.push(quote(row));
 };
 for(const page of pages){
  const lines=page.split("\n");
  const title=lines.findIndex(line=>line==="WYCIĄG Z RACHUNKU BANKOWEGO");
  const account=title<0?null:lines[title+1]?.match(/\b\d{2}(?:\s+\d{4}){6}\b/)?.[0];
  const header=lines.slice(0,title).join(" ");
  const dates=header.match(datePattern);
  const number=header.match(/\b20\d{2}\/\d{3,5}\b/)?.[0];
  if(!account||dates?.length!==3||!number||!header.includes("NR WYCIĄGU"))
   throw Error("Brak pełnego nagłówka wyciągu Erste.");
  const key=JSON.stringify([account.replace(/\s+/g,""),number,...dates]);
  const balancesForStatement=balances.get(key)||{previous:null};
  balances.set(key,balancesForStatement);
  rows.push(quote([number,...dates]),quote(["NR WYCIĄGU OBCIĄŻENIA"]),
   quote([lines[title]]),quote([account]));
  for(const sourceLine of lines.slice(title+2)){
   const line=sourceLine.replace(/^\d{2}-\d{2}-20\d{2}\s+(?=Saldo )/,"");
   const accountType=line.match(/Rachunek (?:bieżący|VAT)/)?.[0];
   if(accountType){
    const info=line.match(/\b(PLN|EUR|USD)\b/);
    const count=line.match(/\b(?:Liczba pozycji|Pozycje)\s*:?\s*(\d{1,4})\b/i);
    if(info&&count)push(13,{0:accountType,1:info[1],2:count[1]});
   }
   if(/^Saldo (?:początkowe|końcowe):/.test(line)){
    const value=line.match(amountPattern)?.at(-1);
    if(!value)throw Error("Brak salda wyciągu PDF.");
    if(line.startsWith("Saldo początkowe:"))balancesForStatement.previous=parseAmount(value)?.cents;
    push(13,{2:line.split(":")[0]+":",10:value});
    continue;
   }
   const row=/^(\d{1,4})\s+(\d{2}-\d{2}-20\d{2})\s+(.+)$/.exec(line);
   if(!row)continue;
   const amounts=[...row[3].matchAll(amountPattern)];
   const [printed,end]=amounts.slice(-2);
   const balance=end&&parseAmount(end[0])?.cents;
   const value=printed&&parseAmount(printed[0])?.cents;
   if(balance==null||value==null||balancesForStatement.previous==null)
    throw Error("Niekompletna operacja PDF.");
   const delta=balance-balancesForStatement.previous;
   const absolute=delta<0n?-delta:delta;
   if(!absolute||(value<0n?-value:value)!==absolute||
    row[3].slice(end.index+end[0].length).trim())
    throw Error("Saldo i kwota PDF nie są zgodne.");
   balancesForStatement.previous=balance;
   push(13,{0:row[1],1:row[2],2:row[3].slice(0,printed.index).trim(),
    [delta<0n?4:6]:printed[0].replace(/^-/,""),10:end[0]});
  }
 }
 return parseErstePrintedCsv(Buffer.from(rows.join("\n")));
}
module.exports={parseErsteStatementPdf};
