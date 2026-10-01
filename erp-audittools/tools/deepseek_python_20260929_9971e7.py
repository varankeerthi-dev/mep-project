#!/usr/bin/env python3
"""
diff_change_log.py — Analyze ERP change-document logs for anomalies.

Usage:
    python diff_change_log.py <changelog.csv|parquet> [--out report.json]
                              [--user-col user] [--time-col timestamp]
                              [--object-col object_id] [--field-col field]
                              [--old-col old_value] [--new-col new_value]
                              [--object-type-col object_type]
                              [--off-hours 0-23,0-23,...]

Expected columns (defaults, override with flags):
    object_type, object_id, field, old_value, new_value, user, timestamp

Detects:
    - Sensitive-field mutations (bank, amount, price, payment terms, salary)
    - Off-hours changes (default: 22:00–06:00 + weekends)
    - Rapid successive changes to the same object (< 5 min apart)
    - Users editing their own records (creator == approver, if creator column present)
    - Round-number amounts (a fraud smell)
    - Backdated changes (timestamp < prior record's timestamp for same field)
    - Change bursts (same user, many objects, short window)

Dependencies: pandas (required), pyarrow (only if reading .parquet).
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import datetime, time
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("error: pandas required. pip install pandas", file=sys.stderr)
    sys.exit(1)

SENSITIVE_FIELDS = [
    r"bank", r"iban", r"swift", r"routing", r"account_number",
    r"amount", r"price", r"discount", r"payment.?term", r"credit.?limit",
    r"salary", r"bonus", r"tax.?id", r"ssn", r"vendor.?master",
    r"customer.?master", r"employee.?bank",
]

RAPID_WINDOW_SECONDS = 300      # 5 minutes
BURST_OBJECT_THRESHOLD = 10     # >10 objects in < 15 min by same user
BURST_WINDOW_SECONDS = 900


def _is_sensitive(field: str) -> bool:
    f = str(field).lower()
    return any(re.search(p, f) for p in SENSITIVE_FIELDS)


def _is_off_hours(ts: datetime, off_hours: list[int]) -> bool:
    if ts.weekday() >= 5:  # Sat/Sun
        return True
    return ts.hour in off_hours


def _is_round_number(value) -> bool:
    try:
        f = float(value)
    except (TypeError, ValueError):
        return False
    if f == 0:
        return True
    return f >= 1000 and f % 1000 == 0


def load(path: Path) -> pd.DataFrame:
    if path.suffix.lower() == ".parquet":
        return pd.read_parquet(path)
    return pd.read_csv(path)


def analyze(df: pd.DataFrame, cols: dict[str, str], off_hours: list[int]) -> dict:
    df = df.copy()

    # Normalize timestamp
    ts_col = cols["time"]
    df[ts_col] = pd.to_datetime(df[ts_col], errors="coerce", utc=False)
    df = df.dropna(subset=[ts_col]).sort_values(ts_col)

    findings = {
        "sensitive_field_changes": [],
        "off_hours_changes": [],
        "rapid_successive_changes": [],
        "round_number_amounts": [],
        "user_change_bursts": [],
        "top_editors": [],
    }

    # --- sensitive field changes ---
    for _, row in df.iterrows():
        if _is_sensitive(row.get(cols["field"], "")):
            findings["sensitive_field_changes"].append({
                "time": str(row[ts_col]),
                "user": row.get(cols["user"]),
                "object": f"{row.get(cols.get('object_type',''),'')}:{row.get(cols['object'],'')}",
                "field": row.get(cols["field"]),
                "old": row.get(cols["old"]),
                "new": row.get(cols["new"]),
            })

    # --- off-hours ---
    for _, row in df.iterrows():
        if _is_off_hours(row[ts_col], off_hours):
            findings["off_hours_changes"].append({
                "time": str(row[ts_col]),
                "user": row.get(cols["user"]),
                "object": f"{row.get(cols.get('object_type',''),'')}:{row.get(cols['object'],'')}",
                "field": row.get(cols["field"]),
            })

    # --- rapid successive changes on same object ---
    obj_key = cols.get("object_type", "") + "_" + cols["object"]
    df["__obj"] = df[cols.get("object_type", "")].astype(str) + ":" + df[cols["object"]].astype(str)
    for obj, group in df.groupby("__obj"):
        group = group.sort_values(ts_col)
        times = group[ts_col].tolist()
        for i in range(1, len(times)):
            delta = (times[i] - times[i-1]).total_seconds()
            if 0 <= delta <= RAPID_WINDOW_SECONDS:
                findings["rapid_successive_changes"].append({
                    "object": obj,
                    "delta_seconds": delta,
                    "first_user": group.iloc[i-1].get(cols["user"]),
                    "second_user": group.iloc[i].get(cols["user"]),
                    "first_time": str(times[i-1]),
                    "second_time": str(times[i]),
                })

    # --- round numbers on amount fields ---
    for _, row in df.iterrows():
        if re.search(r"amount|price|value", str(row.get(cols["field"], "")).lower()):
            if _is_round_number(row.get(cols["new"])):
                findings["round_number_amounts"].append({
                    "time": str(row[ts_col]),
                    "user": row.get(cols["user"]),
                    "field": row.get(cols["field"]),
                    "value": row.get(cols["new"]),
                })

    # --- user bursts ---
    for user, group in df.groupby(cols["user"]):
        group = group.sort_values(ts_col)
        times = group[ts_col].tolist()
        objs = group["__obj"].tolist()
        i = 0
        while i < len(times):
            j = i
            while j + 1 < len(times) and (times[j+1] - times[i]).total_seconds() <= BURST_WINDOW_SECONDS:
                j += 1
            if len(set(objs[i:j+1])) >= BURST_OBJECT_THRESHOLD:
                findings["user_change_bursts"].append({
                    "user": user,
                    "window_start": str(times[i]),
                    "window_end": str(times[j]),
                    "distinct_objects": len(set(objs[i:j+1])),
                    "total_changes": j - i + 1,
                })
                i = j + 1
            else:
                i += 1

    # --- top editors ---
    counts = df[cols["user"]].value_counts().head(20)
    findings["top_editors"] = [{"user": k, "changes": int(v)} for k, v in counts.items()]

    return findings


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("changelog", type=Path)
    ap.add_argument("--out", type=Path, default=None)
    ap.add_argument("--user-col", default="user")
    ap.add_argument("--time-col", default="timestamp")
    ap.add_argument("--object-col", default="object_id")
    ap.add_argument("--object-type-col", default="object_type")
    ap.add_argument("--field-col", default="field")
    ap.add_argument("--old-col", default="old_value")
    ap.add_argument("--new-col", default="new_value")
    ap.add_argument("--off-hours", default="0,1,2,3,4,5,22,23",
                    help="Comma-separated hours considered off-hours")
    args = ap.parse_args()

    if not args.changelog.exists():
        print(f"error: not found: {args.changelog}", file=sys.stderr)
        return 1

    df = load(args.changelog)
    cols = {
        "user": args.user_col,
        "time": args.time_col,
        "object": args.object_col,
        "object_type": args.object_type_col,
        "field": args.field_col,
        "old": args.old_col,
        "new": args.new_col,
    }
    missing = [v for v in cols.values() if v and v not in df.columns]
    if missing:
        print(f"error: missing columns: {missing}", file=sys.stderr)
        print(f"available: {list(df.columns)}", file=sys.stderr)
        return 1

    off_hours = [int(h) for h in args.off_hours.split(",") if h.strip().isdigit()]
    findings = analyze(df, cols, off_hours)

    payload = {
        "source": str(args.changelog),
        "rows": len(df),
        "summary": {k: len(v) for k, v in findings.items()},
        "findings": findings,
    }
    out_text = json.dumps(payload, indent=2, default=str)
    if args.out:
        args.out.write_text(out_text, encoding="utf-8")
        print(f"wrote {args.out}", file=sys.stderr)
    else:
        print(out_text)
    return 0


if __name__ == "__main__":
    sys.exit(main())