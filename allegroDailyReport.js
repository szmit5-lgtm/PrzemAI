'use strict';
const { buildDailyReport } = require('./allegroOpportunity');

function renderOpportunityReport(items, date) {
  const report = buildDailyReport(items, date);
  const lines = [
    '# Allegro Łowca Okazji — ' + date,
    '',
    'Dane wejściowe: ' + report.checked + ' | kandydaci: ' + report.candidates.length +
      ' | do weryfikacji: ' + report.needsVerification.length +
      ' | nieopłacalne: ' + report.notProfitable.length,
    '',
    'Raport analityczny — nie stanowi potwierdzenia aktualnych cen bez weryfikacji źródeł.',
    ''
  ];
  if (report.checked === 0) lines.push('Brak pobranych ofert. Nie znaleziono ani nie potwierdzono żadnych okazji.', '');
  const sections = [
    ['Kandydaci', report.candidates],
    ['Wymagają weryfikacji', report.needsVerification],
    ['Nieopłacalne', report.notProfitable]
  ];
  for (const [title, entries] of sections) {
    lines.push('## ' + title);
    if (!entries.length) { lines.push('Brak.', ''); continue; }
    for (const {item, assessment} of entries) {
      const clean = value => String(value ?? 'brak').replace(/[\r\n|]/g, ' ').slice(0, 250);
      lines.push('- ' + clean(item.store) + ' — ' + clean(item.product) +
        ' | EAN: ' + clean(item.ean) +
        ' | zakup: ' + (Number.isFinite(item.purchasePrice) ? item.purchasePrice.toFixed(2) + ' PLN' : 'niezweryfikowany') +
        ' | sprzedaż: ' + (Number.isFinite(item.salePrice) ? item.salePrice.toFixed(2) + ' PLN' : 'niezweryfikowana'));
      lines.push('  Źródło: ' + clean(item.sourceUrl) + ' | sprawdzono: ' + clean(item.checkedAt) +
        ' | promocja: ' + clean(item.promotionStart) + ' – ' + clean(item.promotionEnd) +
        ' | konkurencyjne oferty: ' + clean(item.competitorCount));
      if (assessment.status === 'candidate') {
        lines.push('  Zysk: ' + assessment.profit.toFixed(2) + ' PLN | marża: ' +
          assessment.marginPercent + '% | ROI: ' + assessment.roiPercent + '%');
      } else lines.push('  Powody: ' + assessment.reasons.join(', '));
    }
    lines.push('');
  }
  return lines.join('\n');
}

module.exports = { renderOpportunityReport };
