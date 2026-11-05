"use strict";

// KSeF XML is untrusted document data. Read only named FA3 fields, bound output
// and never execute or interpret document instructions.
const MAX_XML = 2_000_000;
const UNTRUSTED_ENTITY = /<!\s*(?:DOCTYPE|ENTITY)\b/i;
const decode = value => value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (match, numeric, named) => {
  if (numeric) {
    const n = numeric[0].toLowerCase() === "x" ? parseInt(numeric.slice(1),16) : parseInt(numeric,10);
    return n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  }
  return ({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"})[named.toLowerCase()] || match;
});
const clean = value => decode(value.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim()).slice(0,300);
function elements(xml,name,max=100) {
  const tag = name.replace(/[^A-Za-z0-9_]/g,"");
  const regex = new RegExp("<(?:[A-Za-z][\\w.-]*:)?" + tag + "\\b[^>]*>([\\s\\S]*?)<\\/(?:[A-Za-z][\\w.-]*:)?" + tag + "\\s*>","g");
  const found = [];
  let m;
  while ((m = regex.exec(xml)) !== null && found.length < max) found.push(m[1]);
  return found;
}
function tokens(value) {
  return value.toLocaleLowerCase("pl-PL").replace(/ł/g, "l").normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g," ").replace(/\s+/g," ").trim();
}
function wholeMatch(haystack,needle) {
  const h = " " + haystack + " ";
  return h.includes(" " + needle + " ");
}
function meaningfulAlias(value) {
  const s = tokens(value);
  return s.length >= 6 && s.split(" ").length <= 6 && !["budowa","roboty","instalacje","materialy","uslugi","inwestycja","dekonica"].includes(s);
}
function analyzeKsefXml(xml,projects=[]) {
  if (typeof xml !== "string" || xml.length > MAX_XML || UNTRUSTED_ENTITY.test(xml) ||
      !/^\s*(?:<\?xml[^>]*>\s*)?<(?:[A-Za-z][\w.-]*:)?Faktura\b/.test(xml)) {
    throw new Error("Invalid KSeF document for analysis.");
  }
  const rows = elements(xml,"FaWiersz",251);
  // On advance invoices, positions may be in Zamowienie/P_7Z instead of FaWiersz/P_7.
  const regularItems = rows.slice(0,250).map(row => clean(elements(row,"P_7",1)[0] || "")).filter(Boolean);
  const orderItems = elements(xml,"P_7Z",100).map(clean).filter(Boolean);
  const items = regularItems.length ? regularItems : orderItems;
  const title = items.length
    ? clean(items[0]).slice(0,115)
    : null;
  const description = items.length
    ? items.slice(0,3).join("; ") + (items.length > 3 ? " (+" + (items.length-3) + " kolejnych pozycji)" : "")
    : "Brak pozycji towarów/usług w odczytanym XML";
  // Payment date comes from explicit due date only; do not infer payment from invoice issue date.
  const payment = elements(xml,"Platnosc",1)[0] || "";
  const due = elements(payment,"TerminPlatnosci",5)
    .flatMap(part => elements(part,"Termin",2))
    .map(date => clean(date)).find(value => /^\d{4}-\d{2}-\d{2}$/.test(value)) || null;
  const dueDate = due ? new Date(due + "T12:00:00.000Z") : null;
  const isValidDue = dueDate && !Number.isNaN(dueDate.getTime()) &&
    dueDate.toISOString().startsWith(due);
  // Match project names and aliases only in descriptions and dedicated extra
  // document descriptions, never in seller/buyer fields or generic identifiers.
  const extra = elements(xml,"DodatkowyOpis",100)
    .map(part=>clean(elements(part,"Wartosc",1)[0] || "")).filter(Boolean);
  // Official FA(3) includes optional contract/order identifiers. They can
  // name the worksite even if the product lines are generic.
  const orders = elements(xml,"NrZamowienia",100).map(clean).filter(Boolean);
  const contracts = elements(xml,"NrUmowy",100).map(clean).filter(Boolean);
  const evidence = tokens([...regularItems.slice(0,250),...orderItems,
    ...extra,...orders,...contracts].join(" "));
  const matches = [];
  for (const project of projects.slice(0,300)) {
    if (project.status && project.status !== "ACTIVE") continue;
    const projectName = tokens(String(project.name || ""));
    // Polish grammatical inflections used in construction invoices.
    const inflections = projectName === "mielno" ? ["mielnie"] :
      projectName === "zgorzelec" ? ["zgorzelcu","zgorzelca"] : [];
    const aliases = [project.name,...inflections,
      ...(Array.isArray(project.aliases) ? project.aliases : [])];
    if (aliases.some(alias=>typeof alias === "string" && meaningfulAlias(alias) &&
      wholeMatch(evidence,tokens(alias)))) matches.push(project);
  }
  const unique = matches.length === 1 ? matches[0] : null;
  return {
    title,
    description,
    itemCount: items.length,
    itemPreview: items.slice(0,5),
    dueDate: isValidDue ? dueDate : null,
    projectId: unique?.id || null,
    projectDecision: unique ? "AUTO_ASSIGNED" : matches.length > 1 ? "AMBIGUOUS" : "REVIEW_REQUIRED",
    projectHint: unique?.name || null
  };
}

module.exports = { analyzeKsefXml };
