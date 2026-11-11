#!/usr/bin/env python3
"""Read-only bank PDF extraction prototype; requires pdfplumber.

Usage: python tools/bank_statement_pdf_extract.py input.pdf output.csv
Does not connect to banks, KSeF, or the PrzemAI database.
"""
import csv
import hashlib
import re
import sys
from decimal import Decimal
import pdfplumber

MONEY = r"-?\d{1,3}(?: \d{3})*,\d{2}"
ROW = re.compile(r"^\s*(\d{1,4})\s+(\d\d-\d\d-20\d\d)\s+(.+)$")
ACCOUNT = re.compile(r"(\d\d(?: \d{4}){5}\s\d{4})")
STATEMENT = re.compile(r"20\d\d/\d{3}")

def cents(value):
    return int(Decimal(value.replace(" ", "").replace(",", ".")) * 100)

def parse(pdf_path):
    operations, statements, previous, errors = [], {}, {}, []
    with pdfplumber.open(pdf_path) as pdf:
        for page_no, page in enumerate(pdf.pages, 1):
            lines = (page.extract_text() or "").splitlines()
            account = next((re.sub(r"\s+", "", m.group(1)) for line in lines[:12]
                            if (m := ACCOUNT.search(line))), None)
            number = next((m.group() for line in lines[:5]
                           if (m := STATEMENT.search(line))), None)
            if not account or not number:
                errors.append(f"page {page_no}: missing account or statement number")
                continue
            key = (account, number)
            if key not in statements:
                statements[key] = {"opening": None, "closing": None,
                                   "debits": None, "credits": None}
            st = statements[key]
            for line in lines:
                if "Saldo początkowe:" in line:
                    amounts = re.findall(MONEY, line)
                    if amounts:
                        st["opening"] = cents(amounts[-1])
                        previous[key] = st["opening"]
                if "Saldo końcowe:" in line:
                    amounts = re.findall(MONEY, line)
                    if len(amounts) >= 3:
                        st["debits"], st["credits"], st["closing"] = map(cents, amounts[-3:])
                    elif len(amounts) == 2:
                        st["debits"], st["closing"] = map(cents, amounts)
                        st["credits"] = 0
                match = ROW.match(line)
                if not match:
                    continue
                position, date, tail = match.groups()
                amounts = re.findall(MONEY, tail)
                if len(amounts) < 2 or key not in previous:
                    errors.append(f"page {page_no}, position {position}: insufficient values")
                    continue
                balance = cents(amounts[-1])
                delta = balance - previous[key]
                amount = abs(delta)
                printed = amounts[-2].replace(" ", "")
                expected = f"{amount // 100},{amount % 100:02d}"
                if not printed.endswith(expected):
                    errors.append(f"page {page_no}, position {position}: amount mismatch")
                identity = f"{account}|{number}|{position}|{date}|{amount}|{balance}"
                operations.append({
                    "id": hashlib.sha256(identity.encode()).hexdigest()[:24],
                    "account": account, "statement": number,
                    "page": page_no, "position": int(position), "date": date,
                    "direction": "credit" if delta >= 0 else "debit",
                    "amount_pln": f"{amount / 100:.2f}",
                    "balance_pln": f"{balance / 100:.2f}",
                    "raw_row": line,
                })
                previous[key] = balance
    for key, st in statements.items():
        rows = [row for row in operations if (row["account"], row["statement"]) == key]
        debits = sum(int(Decimal(row["amount_pln"]) * 100) for row in rows
                     if row["direction"] == "debit")
        credits = sum(int(Decimal(row["amount_pln"]) * 100) for row in rows
                      if row["direction"] == "credit")
        if st["opening"] is None or st["closing"] is None:
            errors.append(f"{key}: missing opening/closing balance")
        elif st["opening"] + credits - debits != st["closing"]:
            errors.append(f"{key}: running balance mismatch")
        if st["debits"] is not None and (st["debits"] != debits or st["credits"] != credits):
            errors.append(f"{key}: statement totals mismatch")
    return operations, statements, errors

def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: bank_statement_pdf_extract.py input.pdf output.csv")
    operations, statements, errors = parse(sys.argv[1])
    if errors:
        for error in errors[:30]:
            print(error, file=sys.stderr)
        raise SystemExit(f"Validation failed: {len(errors)} errors; CSV not written")
    with open(sys.argv[2], "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(operations[0]))
        writer.writeheader()
        writer.writerows(operations)
    print(f"Validated {len(operations)} operations across {len(statements)} statements")

if __name__ == "__main__":
    main()
