#!/usr/bin/env python3
"""
API-Coverage-Scanner für die Zeekr EU Integration.

Walks dump JSONs, collects every leaf key path, and checks which keys
are referenced as string literals in custom_components/zeekr_eu/. Keys
not found are flagged as "unmapped" candidates for new entities.

Usage:
    python3 scripts/api_coverage.py                     # scan all dumps
    python3 scripts/api_coverage.py <dump_dir_or_file>  # scan a subset
    python3 scripts/api_coverage.py --out report.md     # custom output path

Default input:  zeekr_eu_dumps/ (all session dirs + auto_archive)
Default source: custom_components/zeekr_eu/
Default output: zeekr_eu_dumps/_coverage.md
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DUMPS = PROJECT_ROOT / "zeekr_eu_dumps"
DEFAULT_SOURCE = PROJECT_ROOT / "custom_components" / "zeekr_eu"
DEFAULT_OUT = DEFAULT_DUMPS / "_coverage.md"

# Wrapper/meta keys that never become entities
SKIP_KEYS = {"code", "msg", "data", "success", "timestamp", "total", "pageSize", "pageNum", "pages"}

# Files inside dump sessions we don't want to analyse
SKIP_FILES = {"_summary.json", "_coverage.md"}


def iter_leaves(node, path=()):
    """Yield (dotted_path, leaf_key, sample_value) for every leaf in a JSON tree."""
    if isinstance(node, dict):
        for k, v in node.items():
            yield from iter_leaves(v, path + (k,))
    elif isinstance(node, list):
        # Descend into the first non-null item only — lists of records have the
        # same shape per entry, so one sample is enough to catalogue keys.
        for item in node:
            if item is not None:
                yield from iter_leaves(item, path)
                break
    else:
        if path:
            yield ".".join(path), path[-1], node


def load_source_literals(source_dir: Path) -> str:
    """Return the concatenated text of every Python file in source_dir."""
    chunks = []
    for py in source_dir.rglob("*.py"):
        try:
            chunks.append(py.read_text(encoding="utf-8", errors="replace"))
        except OSError:
            pass
    return "\n".join(chunks)


def build_literal_index(source_text: str) -> set[str]:
    """Extract every single-/double-quoted string literal from the source."""
    return set(re.findall(r"""['"]([A-Za-z_][A-Za-z0-9_]*)['"]""", source_text))


def collect_json_files(target: Path) -> list[Path]:
    if target.is_file():
        return [target]
    return sorted(p for p in target.rglob("*.json") if p.name not in SKIP_FILES)


def endpoint_for(path: Path, root: Path) -> str:
    """Group key: the session dir's filename, or 'auto_archive' for polls."""
    try:
        rel = path.relative_to(root)
    except ValueError:
        rel = path
    parts = rel.parts
    if parts and parts[0] == "auto_archive":
        return "auto_archive (merged polls)"
    # session-dir/<endpoint>.json
    return path.stem


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("target", nargs="?", default=str(DEFAULT_DUMPS))
    ap.add_argument("--source", default=str(DEFAULT_SOURCE))
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args()

    target = Path(args.target)
    source = Path(args.source)
    out = Path(args.out)

    if not target.exists():
        print(f"Dump path not found: {target}", file=sys.stderr)
        return 1
    if not source.exists():
        print(f"Source path not found: {source}", file=sys.stderr)
        return 1

    literals = build_literal_index(load_source_literals(source))
    files = collect_json_files(target)
    if not files:
        print(f"No JSON files under {target}", file=sys.stderr)
        return 1

    # endpoint -> { leaf_key -> (dotted_path, sample, mapped) }
    per_endpoint: dict[str, dict[str, tuple[str, object, bool]]] = defaultdict(dict)

    for fp in files:
        try:
            data = json.loads(fp.read_text(encoding="utf-8", errors="replace"))
        except (OSError, json.JSONDecodeError) as e:
            print(f"skip {fp}: {e}", file=sys.stderr)
            continue
        endpoint = endpoint_for(fp, target if target.is_dir() else target.parent)
        bucket = per_endpoint[endpoint]
        for dotted, leaf, sample in iter_leaves(data):
            if leaf in SKIP_KEYS:
                continue
            if leaf in bucket:
                continue
            bucket[leaf] = (dotted, sample, leaf in literals)

    total_keys = sum(len(b) for b in per_endpoint.values())
    unmapped_keys = sum(1 for b in per_endpoint.values() for _, _, m in b.values() if not m)

    lines: list[str] = []
    lines.append("# Zeekr API Coverage Report")
    lines.append("")
    lines.append(f"- Scanned: `{target}` ({len(files)} JSON files)")
    lines.append(f"- Source:  `{source}`")
    lines.append(f"- Unique leaf keys: **{total_keys}**")
    lines.append(f"- Unmapped (not found as string literal in source): **{unmapped_keys}**")
    lines.append("")

    for endpoint in sorted(per_endpoint):
        bucket = per_endpoint[endpoint]
        unmapped = [(k, v) for k, v in bucket.items() if not v[2]]
        mapped = [(k, v) for k, v in bucket.items() if v[2]]
        lines.append(f"## {endpoint}")
        lines.append(f"_{len(mapped)} mapped · {len(unmapped)} unmapped_")
        lines.append("")
        if unmapped:
            lines.append("### Unmapped")
            lines.append("")
            lines.append("| Key | Path | Sample |")
            lines.append("|---|---|---|")
            for key, (dotted, sample, _) in sorted(unmapped):
                s = repr(sample)
                if len(s) > 60:
                    s = s[:57] + "…"
                # escape pipes in table cells
                s = s.replace("|", "\\|")
                lines.append(f"| `{key}` | `{dotted}` | `{s}` |")
            lines.append("")

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out} — {unmapped_keys} unmapped of {total_keys} total keys")
    return 0


if __name__ == "__main__":
    sys.exit(main())
