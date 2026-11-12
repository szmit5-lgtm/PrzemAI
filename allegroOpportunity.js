'use strict';
// Read-only shortlist builder. Inputs must come from independently verified sources.
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
function assessOpportunity(item) {
  if (!item || typeof item !== 'object') return {status:'rejected',reasons:['invalid_input']};
  const reasons=[];
  for (const key of ['store','product','sourceUrl','checkedAt','promotionStart','promotionEnd']) {
    if (typeof item[key] !== 'string' || !item[key].trim()) reasons.push('missing_'+key);
  }
  if (!/^https:\/\//i.test(item.sourceUrl || '')) reasons.push('invalid_source_url');
  for (const key of ['checkedAt','promotionStart','promotionEnd']) {
    if (!Number.isFinite(Date.parse(item[key]))) reasons.push('invalid_'+key);
  }
  if (Number.isFinite(Date.parse(item.promotionStart)) && Number.isFinite(Date.parse(item.promotionEnd)) &&
      Date.parse(item.promotionStart)>Date.parse(item.promotionEnd)) reasons.push('invalid_promotion_window');
  if (item.purchasePriceVerified !== true || item.salePriceVerified !== true) reasons.push('unverified_prices');
  if (item.comparableProductVerified !== true) reasons.push('unverified_comparability');
  if (item.resalePermitted !== true) reasons.push('resale_rights_unconfirmed');
  if (item.availabilityVerified !== true) reasons.push('availability_unconfirmed');
  if (!Number.isInteger(item.competitorCount) || item.competitorCount < 0) reasons.push('competitor_count_missing');
  const keys=['purchasePrice','salePrice','marketplaceFee','packingCost','shippingCost','taxCost','adCost'];
  for (const key of keys) if (!finite(item[key])) reasons.push('invalid_'+key);
  if (reasons.length) return {status:'needs_verification',reasons:[...new Set(reasons)]};
  const cost=item.purchasePrice+item.marketplaceFee+item.packingCost+item.shippingCost+item.taxCost+item.adCost;
  const profit=Math.round((item.salePrice-cost)*100)/100;
  const marginPercent=item.salePrice>0?Math.round(profit/item.salePrice*10000)/100:null;
  const roiPercent=cost>0?Math.round(profit/cost*10000)/100:null;
  return {status:profit>0?'candidate':'not_profitable',profit,marginPercent,roiPercent,totalCost:Math.round(cost*100)/100,reasons:profit>0?[]:['non_positive_profit']};
}
function buildDailyReport(items, date) {
  if (!Array.isArray(items) || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new TypeError('invalid_report_input');
  const assessed=items.map(item=>({item,assessment:assessOpportunity(item)}));
  return {date,checked:assessed.length,candidates:assessed.filter(x=>x.assessment.status==='candidate'),needsVerification:assessed.filter(x=>x.assessment.status==='needs_verification'),notProfitable:assessed.filter(x=>x.assessment.status==='not_profitable')};
}
module.exports={assessOpportunity,buildDailyReport};
