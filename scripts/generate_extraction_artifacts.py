#!/usr/bin/env python3
from __future__ import annotations

import csv
import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path


REPO_ROOT = Path("/home/workspace/workspace/leather-making/leathercraft-rebuild")
DATA_ROOT = Path("/home/workspace/workspace/leather-making")
FORM_DETAILS_PATH = DATA_ROOT / "extracted-rsrc" / "rsrc_form_details.txt"
ACTION_TICKET_MAP_PATH = DATA_ROOT / "source_app_action_ticket_map.csv"

ACTION_MATRIX_OUT = REPO_ROOT / "mainform_action_matrix.csv"
FORM_SCHEMA_OUT = REPO_ROOT / "form_schema_options_export_stitching.json"

HEADER_PATTERN = re.compile(r"^===\s+(.+?)\s+\|\s+(.+?)\s+\|")


@dataclass
class FormSection:
    resource_file: str
    form_name: str
    actions: list[str] = field(default_factory=list)
    controls: list[str] = field(default_factory=list)


def canonicalize_action(action: str) -> str:
    value = action.strip()
    if value.endswith("Execute"):
        value = value[: -len("Execute")]
    value = value.replace("LinePallet", "LinePalette")
    return value


def classify_cluster(action: str) -> str:
    if action.startswith(("actAlign", "actRotate", "actScale", "actSpecify", "actSetAs", "actMoveOrCopy")):
        return "Transforms"
    if action.startswith("actLinePalette") or action.startswith("actLinePallet"):
        return "LineTypePalette"
    if action.startswith(("actCenterLine", "actConvert", "actReversePath", "actSplitIntoN", "actDrawBoundary", "actDrawGoldenSpiral", "actDeleteDuplicates", "actEditShapeSize", "actEditLineAngle", "actLineSymmetry", "actDesignHelper_")):
        return "GeometryEdit"
    if action.startswith(("actSelect", "actDeselect", "actDeleteSelected", "actCreateGroup", "actUngroup", "actOrder")):
        return "SelectionOrdering"
    if action.startswith(("actNewProject", "actLoadProject", "actSaveProject", "actClose", "actOpenDemoProject", "actOpenOptions", "actClearAll")):
        return "ProjectLifecycle"
    if action.startswith(("actShowHideGrid", "actShowHideScale", "actShowHideDimensionLines", "actShowHidePrintAreas", "actSetGridBackground", "actResetView")):
        return "ViewportDisplay"
    if action.startswith(("actShow", "actView", "actVisit")):
        return "HelpLinks"
    if action.startswith("actSecret"):
        return "SecretBonus"
    if action.startswith(("actLayer", "actIgnoreLayer")):
        return "LayerAdvanced"
    return "Other"


def infer_control_kind(control_id: str) -> str:
    if control_id.startswith("chk"):
        return "checkbox"
    if control_id.startswith("cmb"):
        return "select"
    if control_id.startswith("rb"):
        return "radio"
    if control_id.startswith("nb"):
        return "number"
    if control_id.startswith("ed"):
        return "text"
    if control_id.startswith("btn"):
        return "button"
    if control_id.startswith("lbl"):
        return "label"
    if control_id.startswith("gb"):
        return "group"
    if control_id.startswith("tab"):
        return "tab"
    if control_id.startswith("tv"):
        return "tree"
    if control_id.startswith(("sw", "switch")):
        return "switch"
    return "other"


def infer_control_domain(control_id: str) -> str:
    lower = control_id.lower()
    if any(token in lower for token in ("stitch", "prick", "thread")):
        return "stitching"
    if any(token in lower for token in ("svg", "dxf")):
        return "export"
    if "print" in lower or "tile" in lower or "dpi" in lower:
        return "print"
    if any(token in lower for token in ("palette", "line", "color")):
        return "line-types"
    if any(token in lower for token in ("auto", "pitch", "zoom", "save", "option")):
        return "options"
    if any(token in lower for token in ("repo", "catalog", "template")):
        return "repository"
    return "general"


def parse_form_sections(path: Path) -> list[FormSection]:
    forms: list[FormSection] = []
    current: FormSection | None = None
    mode: str | None = None

    with path.open("r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.rstrip("\n")
            header = HEADER_PATTERN.match(line)
            if header:
                if current is not None:
                    forms.append(current)
                current = FormSection(resource_file=header.group(1).strip(), form_name=header.group(2).strip())
                mode = None
                continue

            if current is None:
                continue

            if line.startswith("Actions ("):
                mode = "actions"
                continue
            if line.startswith("Controls ("):
                mode = "controls"
                continue
            if not line.strip():
                continue
            if mode == "actions":
                current.actions.append(line.strip())
            elif mode == "controls":
                current.controls.append(line.strip())

    if current is not None:
        forms.append(current)

    return forms


def load_action_ticket_map(path: Path) -> dict[str, dict[str, str]]:
    mapping: dict[str, dict[str, str]] = {}
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            action = (row.get("action") or "").strip()
            if action:
                mapping[action] = row
    return mapping


def build_action_matrix(forms: list[FormSection], ticket_map: dict[str, dict[str, str]]) -> list[dict[str, str]]:
    by_action: dict[str, dict[str, set[str]]] = {}
    source_forms = {"TfrmLeat", "TfrmLeat_Macintosh"}

    for form in forms:
        if form.form_name not in source_forms:
            continue
        for raw_action in form.actions:
            canonical = canonicalize_action(raw_action)
            if not canonical.startswith("act"):
                continue
            item = by_action.setdefault(canonical, {"aliases": set(), "forms": set()})
            item["aliases"].add(raw_action)
            item["forms"].add(form.form_name)

    rows: list[dict[str, str]] = []
    for canonical in sorted(by_action):
        aliases = sorted(by_action[canonical]["aliases"])
        forms_for_action = sorted(by_action[canonical]["forms"])

        matched = ticket_map.get(canonical)
        if matched is None:
            for alias in aliases:
                matched = ticket_map.get(alias)
                if matched is not None:
                    break

        if matched is not None:
            mapped_ticket = matched.get("ticket_id", "")
            feature_group = matched.get("feature_group", "")
            phase = matched.get("phase", "")
            status = "mapped"
        else:
            mapped_ticket = ""
            feature_group = ""
            phase = ""
            status = "unmapped"

        rows.append(
            {
                "action": canonical,
                "aliases": ";".join(aliases),
                "source_forms": ";".join(forms_for_action),
                "cluster": classify_cluster(canonical),
                "mapped_ticket": mapped_ticket,
                "feature_group": feature_group,
                "phase": phase,
                "status": status,
            }
        )

    return rows


def write_action_matrix(rows: list[dict[str, str]], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["action", "aliases", "source_forms", "cluster", "mapped_ticket", "feature_group", "phase", "status"]
    with destination.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def build_form_schema(forms: list[FormSection]) -> dict[str, object]:
    target_forms = {
        "TfrmOptions",
        "TfrmOptions_Macintosh",
        "TfrmSVGExportOptions",
        "TfrmSVGExportOptions_Macintosh",
        "TfrmStitchingHoleSettings",
        "TfrmChangeStitchingHoleType",
        "TfrmEditPallet",
        "TfrmEditPallet_Macintosh",
        "TfrmPreview",
        "TfrmPreview_Macintosh",
        "TfrmRepository",
        "TfrmRepository_Macintosh",
    }

    selected_forms = [form for form in forms if form.form_name in target_forms]
    selected_forms.sort(key=lambda item: item.form_name)

    form_entries: list[dict[str, object]] = []
    for form in selected_forms:
        controls = []
        kind_counts: dict[str, int] = defaultdict(int)
        domain_counts: dict[str, int] = defaultdict(int)

        for control_id in form.controls:
            kind = infer_control_kind(control_id)
            domain = infer_control_domain(control_id)
            kind_counts[kind] += 1
            domain_counts[domain] += 1
            controls.append({"id": control_id, "kind": kind, "domain": domain})

        form_entries.append(
            {
                "form_name": form.form_name,
                "resource_file": form.resource_file,
                "action_count": len(form.actions),
                "control_count": len(form.controls),
                "kind_counts": dict(sorted(kind_counts.items())),
                "domain_counts": dict(sorted(domain_counts.items())),
                "controls": controls,
            }
        )

    return {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source_files": {
            "form_details": str(FORM_DETAILS_PATH),
            "action_ticket_map": str(ACTION_TICKET_MAP_PATH),
        },
        "forms": form_entries,
    }


def write_form_schema(payload: dict[str, object], destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def main() -> None:
    forms = parse_form_sections(FORM_DETAILS_PATH)
    ticket_map = load_action_ticket_map(ACTION_TICKET_MAP_PATH)

    action_rows = build_action_matrix(forms, ticket_map)
    write_action_matrix(action_rows, ACTION_MATRIX_OUT)

    form_schema = build_form_schema(forms)
    write_form_schema(form_schema, FORM_SCHEMA_OUT)

    mapped_count = sum(1 for row in action_rows if row["status"] == "mapped")
    print(f"Wrote {ACTION_MATRIX_OUT} ({len(action_rows)} actions, {mapped_count} mapped)")
    print(f"Wrote {FORM_SCHEMA_OUT} ({len(form_schema['forms'])} forms)")


if __name__ == "__main__":
    main()
