export function parseCsv(text){
 text=String(text||"").replace(/^\uFEFF/,"");
 const lines=[];let row=[],cell="",quoted=false,closed=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){
   if(quoted&&text[i+1]==='"'){cell+='"';i++;}
   else if(quoted){quoted=false;closed=true;}
   else if(!closed&&cell==="")quoted=true;
   else throw Error("Nieprawidłowe cudzysłowy w CSV.");
  }
  else if(ch===";"&&!quoted){row.push(cell.trim());cell="";closed=false;}
  else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&text[i+1]==="\n")i++;row.push(cell.trim());if(row.some(Boolean))lines.push(row);row=[];cell="";closed=false;}
  else {
   if(closed&&!quoted)throw Error("Nieprawidłowy tekst po cudzysłowie w CSV.");
   cell+=ch;
  }
 }
 if(quoted)throw Error("Nieprawidłowe cudzysłowy w CSV.");
 row.push(cell.trim());if(row.some(Boolean))lines.push(row);
 const header=lines.shift()?.map(x=>x.toLowerCase().replace(/^\uFEFF/,""))||[];
 if(new Set(header).size!==header.length||header.some(x=>!x))throw Error("Nagłówki CSV muszą być niepuste i unikalne.");
 const required=["date","amount","description"];
 if(required.some(x=>!header.includes(x)))throw Error("CSV wymaga kolumn: date;amount;description (opcjonalnie counterparty;reference).");
 if(lines.length<1||lines.length>3000)throw Error("CSV musi zawierać od 1 do 3000 transakcji.");
 return lines.map((values,i)=>{
  if(values.length!==header.length)throw Error("Nieprawidłowa liczba kolumn w wierszu "+(i+2));
  const obj=Object.fromEntries(header.map((key,j)=>[key,values[j]||""]));
  const polish=/^(\d{2})[.\-/](\d{2})[.\-/](\d{4})$/.exec(obj.date.trim());
  if(polish)obj.date=`${polish[3]}-${polish[2]}-${polish[1]}`;
  const parsed=/^(\d{4})-(\d{2})-(\d{2})$/.exec(obj.date);
  const checked=parsed?new Date(`${obj.date}T12:00:00Z`):null;
  if(!parsed||!checked||Number.isNaN(checked.getTime())||checked.toISOString().slice(0,10)!==obj.date||!obj.amount)throw Error("Nieprawidłowa data lub kwota w wierszu "+(i+2));
  const rawAmount=obj.amount.replace(/\s/g,"").replace(",",".");
  if(!/^-?\d{1,16}(?:\.\d{1,2})?$/.test(rawAmount))throw Error("Nieprawidłowa kwota w wierszu "+(i+2));
  return {date:obj.date,amount:rawAmount,description:obj.description,counterparty:obj.counterparty||"",reference:obj.reference||""};
 });
}
