"use strict";

const prisma = require("../../lib/prisma");
const { OrganizationError } = require("./OrganizationService");
const { OrganizationFinanceService, ksefDocPredicate } = require("./OrganizationFinanceService");
const { OrganizationBankAccessService } = require("./OrganizationBankAccessService");
const { toCents, money } = require("./OrganizationBankMonthlyService");
const { financeClass } = require("../../lib/financeClassification");

const LIMIT = 20000;
const day = date => date?.toISOString().slice(0, 10);
const warsawDate = new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Warsaw",year:"numeric",month:"2-digit",day:"2-digit"});
const todayInPoland = date => warsawDate.format(date);
const cents = value => toCents(value ?? 0);
const polarity = invoice => invoice.direction === "INCOMING" ? -1n : 1n;
const invalid = message => new OrganizationError(message, 409);
const notFound = message => new OrganizationError(message, 404);

function side(invoice, nip) {
  if (invoice.direction === "INCOMING" && invoice.buyerNip === nip && invoice.sellerNip !== nip) return "sellerNip";
  if (invoice.direction === "OUTGOING" && invoice.sellerNip === nip && invoice.buyerNip !== nip) return "buyerNip";
  return null;
}

function settlement(invoice, organizationId, today) {
  const correction = invoice.correctionLink?.organizationId === organizationId;
  const payments = invoice.verifiedPayments.filter(row => day(row.bankTransaction.bookedAt) <= today);
  const adjustments = invoice.appliedCorrections.filter(row => day(row.correction.issueDate) <= today);
  const gross = invoice.grossAmount == null ? null : cents(invoice.grossAmount);
  const adjusted = gross === null ? null : gross + adjustments.reduce((sum, row) => sum + cents(row.correction.grossAmount), 0n);
  const vat = cents(invoice.vatAmount) + adjustments.reduce((sum, row) => sum + cents(row.correction.vatAmount), 0n);
  const paid = payments.reduce((sum, row) => sum + cents(row.bankTransaction.amount) * polarity(invoice), 0n);
  const open = adjusted === null ? null : adjusted - paid;
  const correctionPending = gross < 0n || /^Kor/i.test(invoice.invoiceType || "");
  const overdue = !correction && !correctionPending && open > 0n && Boolean(invoice.dueDate && day(invoice.dueDate) < today);
  const status = correction ? "CORRECTION_APPLIED" : correctionPending ? "CORRECTION_REVIEW" :
    gross === null ? "UNKNOWN" : open === 0n && paid === 0n ? "CLEARED" : open <= 0n ? "PAID" : paid > 0n ? "PARTIAL" : overdue ? "OVERDUE" : "UNPAID";
  return { gross, adjusted, vat, paid, open, overdue, status, payments };
}

function relations(organizationId) {
  return {
    correctionLink: { select: { organizationId: true, invoiceId: true } },
    appliedCorrections: { where: { organizationId }, select: {
      correction: { select: { grossAmount: true, vatAmount: true, issueDate: true } }
    } },
    verifiedPayments: { where: { organizationId }, select: { bankTransaction: {
      select: { id: true, amount: true, bookedAt: true, bankAccount: { select: { accountType: true } } }
    } } }
  };
}

class OrganizationSettlementService {
  constructor({ db = prisma, finance = new OrganizationFinanceService({ db }),
    bankAccess = new OrganizationBankAccessService({ db }) } = {}) {
    Object.assign(this, { db, finance, bankAccess });
  }

  async scope(userId, organizationId, write = false) {
    const link = await this.finance.accessible(userId, organizationId);
    await this.bankAccess.authorize(userId, organizationId, { ownerOnly: write });
    if (write && link.ownerUserId !== userId)
      throw new OrganizationError("Wymagany jest dostęp właściciela KSeF.", 403);
    return link;
  }

  async report(userId, organizationId, yearInput, asOf = new Date()) {
    const link = await this.scope(userId, organizationId);
    const year = Number(yearInput);
    if (!Number.isInteger(year) || year < 2020 || year > 2100)
      throw new OrganizationError("Nieprawidłowy rok rozliczenia.", 400);
    const today = todayInPoland(asOf);
    const [calendarYear,calendarMonth] = today.split("-").map(Number);
    const monthEnd = day(new Date(Date.UTC(calendarYear, calendarMonth, 0)));
    const invoices = await this.db.financialDocument.findMany({
      where: ksefDocPredicate(link.ownerUserId, link.nip), take: LIMIT + 1,
      orderBy: [{ issueDate: "desc" }, { id: "desc" }],
      select: { id: true, invoiceNumber: true, invoiceType: true, issueDate: true, dueDate: true, direction: true,
        currency: true, grossAmount: true, vatAmount: true, sellerName: true, metadata: true,
        buyerNip: true, sellerNip: true, ...relations(organizationId) }
    });
    if (invoices.length > LIMIT) throw new OrganizationError("Zakres raportu przekracza limit danych.", 413);
    const totals = new Map();
    const items = [];
    const summary = {};
    const diagnostics = {};
    for (const invoice of invoices) {
      if (!side(invoice, link.nip) || day(invoice.issueDate) > today) continue;
      const result = settlement(invoice, organizationId, today);
      const { status, overdue, gross, adjusted, paid, open, payments } = result;
      const bucket = totals.get(invoice.currency) || { receivable: 0n, payable: 0n,
        overdueReceivable: 0n, overduePayable: 0n, refundableReceivable: 0n, refundablePayable: 0n, monthReceivable: 0n, monthPayable: 0n, fixedCosts: 0n };
      totals.set(invoice.currency, bucket);
      if (invoice.issueDate?.getUTCFullYear() === year) {
        const xml = invoice.metadata?.ksefXmlRetry;
        let invalidXml;
        if (xml?.code === "INVALID_XML") {
          const reason = ["SIZE", "EMPTY", "FORMAT", "ENCODING"].includes(xml.reason) ? xml.reason : "UNCLASSIFIED";
          diagnostics[reason] = (diagnostics[reason] || 0) + 1;
          const retry = Date.parse(xml.nextRetryAt);
          invalidXml = { reason, attempts: Number.isInteger(xml.attempts) && xml.attempts >= 0
            ? Math.min(100, xml.attempts) : null,
            nextRetryAt: Number.isFinite(retry) ? new Date(retry).toISOString() : null };
        }
        items.push({ id: invoice.id, invoiceNumber: invoice.invoiceNumber, direction: invoice.direction,
          currency: invoice.currency, dueDate: day(invoice.dueDate), status, overdue,
          gross: gross === null ? null : money(gross), adjusted: adjusted === null ? null : money(adjusted),
          ...(invalidXml && { invalidXml }),
          paid: money(paid), outstanding: open === null ? null : money(open > 0n ? open : 0n),
          overpayment: open === null ? null : money(open < 0n ? -open : 0n),
          payments: payments.map(({ bankTransaction: row }) => ({ transactionId: row.id,
            amount: money(cents(row.amount)), bookedAt: day(row.bookedAt), accountType: row.bankAccount.accountType })) });
        summary[status] = (summary[status] || 0) + 1;
        if (invoice.direction === "INCOMING" && adjusted !== null &&
            !status.startsWith("CORRECTION_") && financeClass(invoice).type === "FIXED") bucket.fixedCosts += adjusted;
      }
      if (status.startsWith("CORRECTION_")) continue;
      const incoming = invoice.direction === "INCOMING";
      if (open < 0n) bucket[incoming ? "refundableReceivable" : "refundablePayable"] -= open;
      if (!(open > 0n)) continue;
      bucket[incoming ? "payable" : "receivable"] += open;
      if (overdue) bucket[incoming ? "overduePayable" : "overdueReceivable"] += open;
      if (invoice.dueDate && day(invoice.dueDate) <= monthEnd)
        bucket[incoming ? "monthPayable" : "monthReceivable"] += open;
    }
    const forecast = await this.forecast(organizationId, asOf, totals);
    const balances = [...totals].map(([currency, row]) => ({
      currency, ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key, money(value)]))
    }));
    return { year, asOf: today, summary, items, forecast, balances, diagnostics };
  }

  async forecast(organizationId, asOf, totals) {
    const accounts = await this.db.bankAccount.findMany({
      where: { organizationId }, take: 201, select: { id: true, currency: true,
        statements: { where: { organizationId, closingBalance: { not: null }, periodEnd: { lte: asOf } },
          orderBy: [{ periodEnd: "desc" }, { importedAt: "desc" }], take: 1,
          select: { closingBalance: true, periodEnd: true } } }
    });
    if (accounts.length > 200) throw new OrganizationError("Za dużo rachunków w raporcie.", 413);
    const currencies = new Map([...totals.keys()].map(currency => [currency, { anchor: 0n, dates: [], missing: 0 }]));
    await Promise.all(accounts.map(async ({ id, currency, statements: [statement] }) => {
      const entry = currencies.get(currency) || { anchor: 0n, dates: [], missing: 0 };
      currencies.set(currency, entry);
      if (!statement) { entry.missing++; return; }
      const activity = await this.db.bankTransaction.aggregate({ where: { organizationId, bankAccountId: id,
        bookedAt: { gt: new Date(day(statement.periodEnd) + "T23:59:59.999Z"), lte: asOf } }, _sum: { amount: true } });
      entry.anchor += cents(statement.closingBalance) + cents(activity._sum.amount);
      entry.dates.push(day(statement.periodEnd));
    }));
    return [...currencies].map(([currency, { anchor, dates, missing }]) => {
      const known = dates.length > 0 && missing === 0;
      const bucket = totals.get(currency);
      return { currency, balanceFromImports: known ? money(anchor) : null, latestClosings: dates.sort(),
        missingAccountBalances: missing, projectedMonthEnd: known
          ? money(anchor + (bucket?.monthReceivable || 0n) - (bucket?.monthPayable || 0n)) : null };
    });
  }

  async confirm(userId, organizationId, invoiceId, transactionId) {
    const link = await this.scope(userId, organizationId, true);
    if (typeof transactionId !== "string" || !transactionId || transactionId.length > 128)
      throw new OrganizationError("Podaj operację bankową.", 400);
    return this.write(async tx => {
      const invoice = await this.invoice(tx, link, organizationId, invoiceId);
      const operation = await tx.bankTransaction.findFirst({ where: { id: transactionId, organizationId,
        bankAccount: { organizationId } }, include: { bankAccount: true, invoicePayment: true } });
      if (!operation) throw notFound("Nie znaleziono operacji tej spółki.");
      if (operation.invoicePayment?.invoiceId === invoiceId &&
          operation.invoicePayment.organizationId === organizationId) return { invoiceId, transactionId };
      const now = new Date();
      const current = settlement(invoice, organizationId, todayInPoland(now));
      const amount = cents(operation.amount) * polarity(invoice);
      const applicable = amount > 0n ? current.open >= amount : amount < 0n && current.open <= amount;
      if (operation.reviewStatus !== "UNMATCHED" || current.status.startsWith("CORRECTION_") ||
          !applicable || current.open === null || operation.bankAccount.currency !== invoice.currency ||
          !invoice.issueDate || day(operation.bookedAt) < day(invoice.issueDate) || day(operation.bookedAt) > todayInPoland(now))
        throw invalid("Operacji nie można rozliczyć z tą fakturą.");
      if (operation.bankAccount.accountType === "VAT") {
        const used = current.payments.reduce((sum, { bankTransaction: row }) =>
          sum + (row.bankAccount.accountType === "VAT" ? cents(row.amount) * polarity(invoice) : 0n), 0n);
        if (amount > 0n ? amount + used > current.vat : amount + used < 0n)
          throw invalid("Operacja VAT nie mieści się w rozliczeniu VAT faktury.");
      }
      const changed = await tx.bankTransaction.updateMany({ where: { id: transactionId, organizationId,
        reviewStatus: "UNMATCHED" }, data: { reviewStatus: "INVOICE_CONFIRMED" } });
      if (changed.count !== 1) throw invalid("Operacja została już zweryfikowana.");
      await tx.invoicePayment.create({ data: { organizationId, invoiceId, bankTransactionId: transactionId,
        confirmedById: userId } });
      return { invoiceId, transactionId };
    });
  }

  async undo(userId, organizationId, transactionId) {
    const link = await this.scope(userId, organizationId, true);
    return this.write(async tx => {
      const payment = await tx.invoicePayment.findFirst({ where: { organizationId, bankTransactionId: transactionId,
        bankTransaction: { organizationId }, invoice: ksefDocPredicate(link.ownerUserId, link.nip) } });
      if (!payment) throw notFound("Nie znaleziono potwierdzenia tej spółki.");
      await tx.invoicePayment.delete({ where: { id: payment.id } });
      await tx.bankTransaction.updateMany({ where: { id: transactionId, organizationId,
        reviewStatus: "INVOICE_CONFIRMED" }, data: { reviewStatus: "UNMATCHED" } });
      return { transactionId };
    });
  }

  async applyCorrection(userId, organizationId, invoiceId, correctionId) {
    const link = await this.scope(userId, organizationId, true);
    if (typeof correctionId !== "string" || !correctionId || correctionId.length > 128 || correctionId === invoiceId)
      throw new OrganizationError("Wybierz oddzielną fakturę korygującą.", 400);
    return this.write(async tx => {
      const original = await this.invoice(tx, link, organizationId, invoiceId);
      const correction = await this.invoice(tx, link, organizationId, correctionId);
      const today = todayInPoland(new Date());
      const base = settlement(original, organizationId, today);
      const delta = cents(correction.grossAmount);
      if (correction.correctionLink?.invoiceId === invoiceId &&
          correction.correctionLink.organizationId === organizationId) return { invoiceId, correctionId };
      const party = side(original, link.nip);
      if (!(base.gross > 0n) || !delta || base.adjusted + delta < 0n || original.correctionLink ||
          base.status === "CORRECTION_REVIEW" || correction.correctionLink || correction.verifiedPayments.length ||
          correction.appliedCorrections.length || correction.currency !== original.currency ||
          original.direction !== correction.direction || !original.issueDate || !correction.issueDate ||
          correction.issueDate < original.issueDate || day(correction.issueDate) > today ||
          !original[party] || original[party] !== correction[party] ||
          (delta > 0n && !/^Kor/i.test(correction.invoiceType || "")))
        throw invalid("Korekty nie można połączyć z tą fakturą.");
      await tx.invoiceCorrection.create({ data: { organizationId, invoiceId, correctionId, confirmedById: userId } });
      return { invoiceId, correctionId };
    });
  }

  async undoCorrection(userId, organizationId, correctionId) {
    const link = await this.scope(userId, organizationId, true);
    return this.write(async tx => {
      const correction = await this.invoice(tx, link, organizationId, correctionId);
      if (correction.correctionLink?.organizationId !== organizationId)
        throw notFound("Nie znaleziono powiązania korekty tej spółki.");
      const original = await this.invoice(tx, link, organizationId, correction.correctionLink.invoiceId);
      const current = settlement(original, organizationId, todayInPoland(new Date()));
      if (current.adjusted - cents(correction.grossAmount) < 0n)
        throw invalid("Najpierw cofnij powiązane korekty.");
      await tx.invoiceCorrection.delete({ where: { correctionId } });
      return { correctionId };
    });
  }

  async invoice(tx, link, organizationId, id) {
    const row = await tx.financialDocument.findFirst({
      where: { id, ...ksefDocPredicate(link.ownerUserId, link.nip) }, include: relations(organizationId)
    });
    if (!row || !side(row, link.nip)) throw notFound("Nie znaleziono faktury tej spółki.");
    return row;
  }

  async write(action) {
    try { return await this.db.$transaction(action, { isolationLevel: "Serializable" }); }
    catch (error) {
      if (["P2002", "P2034"].includes(error.code)) throw invalid("Rozliczenie zmieniło się. Odśwież dane.");
      throw error;
    }
  }
}

module.exports = { OrganizationSettlementService, settlement };
