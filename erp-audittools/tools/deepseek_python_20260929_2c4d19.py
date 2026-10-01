#!/usr/bin/env python3
"""
sod_matrix.py — Segregation-of-Duties violation detector.

Usage:
    python sod_matrix.py <users.json> <roles.json> [--rules custom_rules.json]
                         [--out report.json]

Input formats:
    users.json  : {"alice": ["PO_CREATE", "PO_APPROVE"], "bob": [...]}
                  OR a CSV with columns: user,transaction
    roles.json  : {"PO_CREATE": "Procurement", ...}  (optional, for reporting)
    custom_rules: {"forbidden_pairs": [["A","B"], ...]}

Default forbidden pairs follow SAP F110 / standard SoD baselines.
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Default forbidden pairs — extend per module in custom_rules.json
# Each pair = two transactions no single user should hold.
# ---------------------------------------------------------------------------
DEFAULT_FORBIDDEN: list[tuple[str, str]] = [
    # --- Procure-to-Pay ---
    ("VENDOR_CREATE",            "PO_CREATE"),
    ("VENDOR_CREATE",            "PAYMENT_RELEASE"),
    ("VENDOR_BANK_EDIT",         "PAYMENT_RELEASE"),
    ("VENDOR_BANK_EDIT",         "PAYMENT_RUN_CREATE"),
    ("PO_CREATE",                "PO_APPROVE"),
    ("PO_APPROVE",               "GR_POST"),
    ("GR_POST",                  "INVOICE_POST"),
    ("INVOICE_POST",             "PAYMENT_RUN_CREATE"),
    ("PAYMENT_RUN_CREATE",       "PAYMENT_RELEASE"),   # SAP F110 baseline
    # --- Order-to-Cash ---
    ("CUSTOMER_CREATE",          "CREDIT_LIMIT_EDIT"),
    ("SALES_ORDER_CREATE",       "DISCOUNT_OVERRIDE"),
    ("INVOICE_POST",             "CREDIT_MEMO_POST"),
    ("CASH_APPLY",               "WRITE_OFF"),
    ("SALES_REP",                "COMMISSION_APPROVE"),
    # --- Finance ---
    ("JE_CREATE",                "JE_APPROVE"),
    ("JE_APPROVE",               "PERIOD_CLOSE"),
    ("BANK_RECON",               "HOUSE_BANK_EDIT"),
    ("FIXED_ASSET_CAPITALIZE",   "DEPRECIATION_RUN"),
    ("TREASURY_DEAL_ENTRY",      "TREASURY_DEAL_CONFIRM"),
    # --- HR / Payroll ---
    ("EMPLOYEE_MASTER_EDIT",     "PAYROLL_RUN"),
    ("PAYROLL_RUN_CREATE",       "PAYROLL_APPROVE"),
    ("TIMESHEET_SUBMIT",         "TIMESHEET_APPROVE"),
    ("EXPENSE_SUBMIT",           "EXPENSE_APPROVE"),
    ("EXPENSE_APPROVE",          "EXPENSE_REIMBURSE"),
    # --- Inventory ---
    ("ITEM_MASTER_EDIT",         "STOCK_ADJUST"),
    ("CYCLE_COUNT_ENTER",        "CYCLE_COUNT_APPROVE"),
    ("STOCK_TRANSFER_CREATE",    "STOCK_TRANSFER_RECEIVE"),
    # --- Manufacturing ---
    ("BOM_EDIT",                 "WORK_ORDER_RELEASE"),
    ("SCRAP_POST",               "PRODUCTION_CONFIRM"),
    # --- Security ---
    ("USER_CREATE",              "ROLE_ASSIGN"),
    ("ROLE_ASSIGN",              "USER_DELETE"),
]


def load_users(path: Path) -> dict[str, set[str]]:
    if path.suffix.lower() == ".json":
        data = json.loads(path.read_text(encoding="utf-8"))
        return {u: set(t) for u, t in data.items()}
    # CSV: user,transaction  (one row per user-txn)
    out: dict[str, set[str]] = {}
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            u = row.get("user") or row.get("username")
            t = row.get("transaction") or row.get("txn") or row.get("role")
            if not u or not t:
                continue
            out.setdefault(u, set()).add(t)
    return out


def load_rules(path: Path | None) -> list[tuple[str, str]]:
    if not path:
        return DEFAULT_FORBIDDEN
    data = json.loads(path.read_text(encoding="utf-8"))
    extra = [tuple(p) for p in data.get("forbidden_pairs", [])]
    if data.get("replace_defaults"):
        return extra
    return DEFAULT_FORBIDDEN + extra


def find_violations(users: dict[str, set[str]],
                    forbidden: list[tuple[str, str]]) -> list[dict]:
    violations = []
    for user, txns in users.items():
        for a, b in forbidden:
            if a in txns and b in txns:
                violations.append({
                    "user": user,
                    "conflict": [a, b],
                    "risk": "CRITICAL",
                    "reason": f"Single user holds both {a} and {b}",
                })
    return violations


def risk_score(violations: list[dict]) -> dict:
    per_user: dict[str, int] = {}
    for v in violations:
        per_user[v["user"]] = per_user.get(v["user"], 0) + 1
    ranked = sorted(per_user.items(), key=lambda kv: kv[1], reverse=True)
    return {
        "total_violations": len(violations),
        "users_with_violations": len(per_user),
        "worst_offenders": [{"user": u, "violations": c} for u, c in ranked[:10]],
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("users")
    ap.add_argument("roles", nargs="?", default=None,
                    help="Optional roles file (for enrichment)")
    ap.add_argument("--rules", type=Path, default=None)
    ap.add_argument("--out", type=Path, default=None)
    args = ap.parse_args()

    users_path = Path(args.users)
    if not users_path.exists():
        print(f"error: not found: {users_path}", file=sys.stderr)
        return 1

    users = load_users(users_path)
    forbidden = load_rules(args.rules)
    violations = find_violations(users, forbidden)

    payload = {
        "source": str(users_path),
        "users_analyzed": len(users),
        "rules_applied": len(forbidden),
        "summary": risk_score(violations),
        "violations": violations,
    }
    out_text = json.dumps(payload, indent=2)
    if args.out:
        args.out.write_text(out_text, encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        print(out_text)
    return 0 if not violations else 0


if __name__ == "__main__":
    sys.exit(main())