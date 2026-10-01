#!/usr/bin/env python3
"""
extract_config.py — Normalize ERP configuration exports into a flat,
auditable control list.

Usage:
    python extract_config.py <config_file> [--format auto|xml|json|csv]
                             [--out normalized.json]
                             [--module <name>]

Input : ERP config export (XML / JSON / CSV)
Output: JSON list of {module, control_key, value, default, enforced, source}

Exit codes:
    0 = success
    1 = parse error
    2 = unsupported format

Dependencies: standard library only (xml.etree, json, csv).
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Any, Iterable

# ---------------------------------------------------------------------------
# Known control patterns — extend as you learn your ERP's naming.
# Keys are canonical; values are regexes matched against config field names.
# ---------------------------------------------------------------------------
KNOWN_CONTROLS: dict[str, list[str]] = {
    # Procurement
    "tc_checkbox_default":            [r"terms.*condition.*default", r"t&c.*default", r"tnc_default"],
    "tc_checkbox_required":           [r"terms.*condition.*(required|mandatory)", r"t&c.*required"],
    "po_approval_threshold":          [r"po.*approv.*(limit|threshold|amount)"],
    "requisition_required_for_po":    [r"requisition.*required", r"po.*require.*req"],
    "three_way_match_enabled":        [r"three.?way.?match", r"3.?way.?match"],
    "invoice_tolerance_pct":          [r"invoice.*toleran", r"match.*toleran"],
    "vendor_bank_maker_checker":      [r"vendor.*bank.*(approv|maker|checker)"],
    "urgent_po_bypass":               [r"urgent.*(bypass|override)", r"emergency.*po"],
    # Sales / CRM
    "discount_override_cap_pct":      [r"discount.*(cap|limit|max)"],
    "credit_limit_enforced":          [r"credit.*limit.*(enforc|block)"],
    "credit_memo_dual_approval":      [r"credit.*memo.*(dual|second|two).*approv"],
    "price_list_sod":                 [r"price.?list.*(sod|segregat|role)"],
    # Finance
    "je_dual_approval_threshold":     [r"(journal|je).*(dual|second).*approv", r"je.*threshold"],
    "period_lock_enforced":           [r"period.*(lock|close).*(enforc|block)"],
    "payment_release_sod":            [r"payment.*(release|run).*(sod|separate|different)"],
    "fx_rate_override_approval":      [r"fx.*rate.*(override|manual).*approv"],
    # HR / Payroll
    "payroll_bank_change_maker_checker": [r"payroll.*bank.*(maker|checker|approv)"],
    "offcycle_payment_dual_approval": [r"off.?cycle.*(dual|second).*approv"],
    # Inventory
    "stock_adjustment_approval":      [r"stock.*adjust.*approv", r"inventory.*adjust.*approv"],
    "negative_stock_blocked":         [r"negative.*stock.*(block|prevent)"],
    "blind_cycle_count":              [r"(blind|hidden).*cycle.*count"],
    # Security
    "mfa_required_financial":         [r"mfa.*(financial|approver)", r"2fa.*(financial|approver)"],
    "shared_accounts_blocked":        [r"shared.*account.*(block|prevent)"],
    "emergency_access_timeboxed":     [r"(emergency|firefight).*access.*(time|expir)"],
}

# Fields that, if True, are dangerous "less safe" defaults.
DANGEROUS_DEFAULTS = {
    "tc_checkbox_default": True,        # default-checked T&C = nullified control
    "urgent_po_bypass": True,
    "negative_stock_blocked": False,    # False = negative stock allowed
    "credit_limit_enforced": False,
    "period_lock_enforced": False,
    "mfa_required_financial": False,
}


def _canonicalize(field_name: str, module_hint: str = "") -> str | None:
    lname = field_name.lower()
    for canonical, patterns in KNOWN_CONTROLS.items():
        for pat in patterns:
            if re.search(pat, lname):
                return canonical
    return None


def _coerce(value: Any) -> Any:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value
    if value is None:
        return None
    s = str(value).strip().lower()
    if s in {"true", "yes", "y", "1", "on", "enabled"}:
        return True
    if s in {"false", "no", "n", "0", "off", "disabled"}:
        return False
    try:
        return float(s) if "." in s else int(s)
    except ValueError:
        return value


def _walk_xml(elem: ET.Element, path: str = "") -> Iterable[tuple[str, Any]]:
    tag = elem.tag.split("}")[-1]  # strip namespace
    new_path = f"{path}.{tag}" if path else tag
    if len(elem) == 0 and (elem.text or "").strip():
        yield new_path, elem.text.strip()
    for child in elem:
        yield from _walk_xml(child, new_path)
    # also yield attributes
    for k, v in elem.attrib.items():
        yield f"{new_path}@{k}", v


def parse_xml(path: Path) -> list[dict[str, Any]]:
    tree = ET.parse(path)
    out = []
    for key_path, raw in _walk_xml(tree.getroot()):
        leaf = key_path.split(".")[-1]
        out.append({
            "raw_key": key_path,
            "leaf": leaf,
            "value": _coerce(raw),
        })
    return out


def parse_json(path: Path) -> list[dict[str, Any]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    out: list[dict[str, Any]] = []

    def rec(node: Any, path: str):
        if isinstance(node, dict):
            for k, v in node.items():
                rec(v, f"{path}.{k}" if path else k)
        elif isinstance(node, list):
            for i, v in enumerate(node):
                rec(v, f"{path}[{i}]")
        else:
            out.append({
                "raw_key": path,
                "leaf": path.split(".")[-1].split("[")[0],
                "value": _coerce(node),
            })

    rec(data, "")
    return out


def parse_csv(path: Path) -> list[dict[str, Any]]:
    out = []
    with path.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = row.get("key") or row.get("name") or row.get("field")
            value = row.get("value") or row.get("val")
            default = row.get("default")
            enforced = row.get("enforced") or row.get("locked")
            if key is None:
                continue
            out.append({
                "raw_key": str(key),
                "leaf": str(key).split(".")[-1],
                "value": _coerce(value),
                "default": _coerce(default) if default is not None else None,
                "enforced": _coerce(enforced) if enforced is not None else None,
            })
    return out


def detect_format(path: Path, override: str = "auto") -> str:
    if override != "auto":
        return override
    suffix = path.suffix.lower()
    if suffix in {".xml", ".config"}:
        return "xml"
    if suffix in {".json"}:
        return "json"
    if suffix in {".csv", ".tsv"}:
        return "csv"
    # sniff
    head = path.read_text(encoding="utf-8", errors="ignore")[:200].lstrip()
    if head.startswith("{"):
        return "json"
    if head.startswith("<"):
        return "xml"
    return "csv"


def normalize(rows: list[dict[str, Any]], module_hint: str = "") -> list[dict[str, Any]]:
    normalized = []
    for row in rows:
        canonical = _canonicalize(row["raw_key"], module_hint)
        entry = {
            "module": module_hint or _infer_module(row["raw_key"]),
            "control_key": canonical or f"UNMAPPED::{row['leaf']}",
            "raw_key": row["raw_key"],
            "value": row.get("value"),
            "default": row.get("default"),
            "enforced": row.get("enforced"),
            "suspicious_default": False,
        }
        if canonical and canonical in DANGEROUS_DEFAULTS:
            if entry["value"] == DANGEROUS_DEFAULTS[canonical]:
                entry["suspicious_default"] = True
        normalized.append(entry)
    return normalized


def _infer_module(raw_key: str) -> str:
    k = raw_key.lower()
    module_markers = {
        "procurement": ["po_", "purchase", "vendor", "requisition", "grn", "invoice_match"],
        "sales":       ["sales", "customer", "crm", "opportunity", "quote", "credit_memo"],
        "inventory":   ["stock", "inventory", "warehouse", "cycle_count", "item_master"],
        "finance":     ["journal", "gl_", "ap_", "ar_", "payment", "fixed_asset", "treasury"],
        "hr":          ["payroll", "employee", "timesheet", "expense", "benefit"],
        "manufacturing": ["bom", "work_order", "routing", "scrap", "wip"],
        "security":    ["mfa", "password", "role_", "session", "lockout"],
    }
    for mod, markers in module_markers.items():
        if any(m in k for m in markers):
            return mod
    return "unknown"


def main() -> int:
    ap = argparse.ArgumentParser(description="Normalize ERP config exports.")
    ap.add_argument("config_file", type=Path)
    ap.add_argument("--format", default="auto", choices=["auto", "xml", "json", "csv"])
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--module", default="")
    args = ap.parse_args()

    if not args.config_file.exists():
        print(f"error: file not found: {args.config_file}", file=sys.stderr)
        return 1

    fmt = detect_format(args.config_file, args.format)
    try:
        if fmt == "xml":
            rows = parse_xml(args.config_file)
        elif fmt == "json":
            rows = parse_json(args.config_file)
        elif fmt == "csv":
            rows = parse_csv(args.config_file)
        else:
            print(f"error: unsupported format {fmt}", file=sys.stderr)
            return 2
    except Exception as e:
        print(f"error: parse failed: {e}", file=sys.stderr)
        return 1

    normalized = normalize(rows, args.module)

    payload = {
        "source_file": str(args.config_file),
        "format": fmt,
        "total_rows": len(normalized),
        "mapped_rows": sum(1 for r in normalized if not r["control_key"].startswith("UNMAPPED::")),
        "suspicious_defaults": [r for r in normalized if r["suspicious_default"]],
        "controls": normalized,
    }

    out_text = json.dumps(payload, indent=2, default=str)
    if args.out:
        args.out.write_text(out_text, encoding="utf-8")
        print(f"wrote {args.out} ({len(normalized)} controls)", file=sys.stderr)
    else:
        print(out_text)
    return 0


if __name__ == "__main__":
    sys.exit(main())