from __future__ import annotations

import hashlib
import io
import json
import os
import shutil
import tempfile
from pathlib import Path

import pyarrow.parquet as pq
import requests
from PIL import Image, ImageOps

DATASET = "ai4bharat/FERMAT"
REVISION = "80ff9934c38615bb8d3a33c24252db02e21774f0"
SHARDS = {
    0: "train-00000-of-00010.parquet",
    1: "train-00001-of-00010.parquet",
}
SHARD_SHA256 = {
    0: "fc144ae82fb8e2704978f2f74b965a7c85e090997b7c49607f282ea48b1d066f",
    1: "a8216e3780a99d2652afc8e7566d97190863d35b16699c528fee202344b3ed51",
}
SELECTIONS = [
    {"source_id": "img_486_pert_5.1", "shard": 0, "row": 0, "file": "fermat-img_486_pert_5_1.jpg", "expected": {"kind": "correct"}, "label_rationale": "Consistent variable renaming leaves the age equation correct."},
    {"source_id": "img_400_pert_5.1", "shard": 0, "row": 5, "file": "fermat-img_400_pert_5_1.jpg", "expected": {"kind": "correct"}, "label_rationale": "Consistent y-to-z renaming leaves d(a^x)/dx correct."},
    {"source_id": "img_423_pert_3.1", "shard": 1, "row": 117, "file": "fermat-img_423_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 2, "tag": "exponent-rule-error"}, "label_rationale": "sqrt(t) is rewritten as t^2 at the first transformed integral."},
    {"source_id": "img_401_pert_3.1", "shard": 1, "row": 128, "file": "fermat-img_401_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 4, "tag": "algebraic-slip"}, "label_rationale": "A previously correct (6x+4) numerator is halved during an algebraic rewrite."},
    {"source_id": "img_384_pert_3.1", "shard": 1, "row": 140, "file": "fermat-img_384_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 1, "tag": "notation-error"}, "label_rationale": "The derivative term 6x is changed to the nonequivalent notation 6^x."},
    {"source_id": "img_415_pert_3.1", "shard": 1, "row": 164, "file": "fermat-img_415_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 5, "tag": "integration-by-parts-error"}, "label_rationale": "The final integration-by-parts line replaces cos(x) with sin(x)."},
    {"source_id": "img_559_pert_3.1", "shard": 1, "row": 180, "file": "fermat-img_559_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 3, "tag": "notation-error"}, "label_rationale": "The result drops the exponent from 2x^2 to 2x."},
    {"source_id": "img_583_pert_3.1", "shard": 1, "row": 185, "file": "fermat-img_583_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 2, "tag": "distribution-error"}, "label_rationale": "The product expansion changes the cross-term sum 5+6 into 5*6."},
    {"source_id": "img_479_pert_3.1", "shard": 1, "row": 191, "file": "fermat-img_479_pert_3_1.jpg", "expected": {"kind": "error", "errorStepIndex": 2, "tag": "formula-misapplied"}, "label_rationale": "The Celsius conversion substitutes reciprocal factor 9/5 for 5/9."},
    {"source_id": "img_584_pert_3.2", "shard": 1, "row": 219, "file": "fermat-img_584_pert_3_2.jpg", "expected": {"kind": "error", "errorStepIndex": 2, "tag": "sign-error"}, "label_rationale": "Evaluating p(2) replaces subtraction with addition."},
]

SERVER_DIR = Path(__file__).resolve().parents[1]
GOLDEN_DIR = SERVER_DIR / "golden"
PHOTO_DIR = GOLDEN_DIR / "photos"


def env_token() -> str:
    if token := os.environ.get("HF_TOKEN"):
        return token
    env_path = SERVER_DIR / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith("HF_TOKEN="):
                return line.split("=", 1)[1].strip()
    raise RuntimeError("HF_TOKEN is required; accept FERMAT access and set it in server/.env")


def verify_shard(number: int, path: Path) -> Path:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    actual = digest.hexdigest()
    expected = SHARD_SHA256[number]
    if actual != expected:
        raise RuntimeError(f"SHA-256 mismatch for {path}: expected {expected}, got {actual}")
    return path


def promote_legacy_shard(number: int, legacy: Path, target: Path) -> Path:
    verify_shard(number, legacy)
    target.parent.mkdir(parents=True, exist_ok=True)
    try:
        target.hardlink_to(legacy)
    except FileExistsError:
        pass
    except OSError:
        partial = target.with_name(f"{target.name}.legacy-partial")
        shutil.copy2(legacy, partial)
        partial.replace(target)
    return verify_shard(number, target)


def download_shard(number: int, cache_dir: Path, token: str) -> Path:
    filename = SHARDS[number]
    target = cache_dir / REVISION / filename
    if target.exists():
        return verify_shard(number, target)
    legacy = cache_dir / filename
    if legacy.exists():
        return promote_legacy_shard(number, legacy, target)
    target.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://huggingface.co/datasets/{DATASET}/resolve/{REVISION}/data/{filename}"
    with requests.get(url, headers={"Authorization": f"Bearer {token}"}, stream=True, timeout=60) as response:
        response.raise_for_status()
        partial = target.with_name(f"{target.name}.partial")
        with partial.open("wb") as output:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                output.write(chunk)
        partial.replace(target)
    return verify_shard(number, target)


def main() -> None:
    token = env_token()
    cache_dir = Path(os.environ.get("FERMAT_CACHE_DIR", Path(tempfile.gettempdir()) / "snap-a-mistake-fermat"))
    cache_dir.mkdir(parents=True, exist_ok=True)
    PHOTO_DIR.mkdir(parents=True, exist_ok=True)
    tables = {
        number: pq.read_table(download_shard(number, cache_dir, token))
        for number in sorted({item["shard"] for item in SELECTIONS})
    }
    records = []
    for selected in SELECTIONS:
        row = tables[selected["shard"]].slice(selected["row"], 1).to_pylist()[0]
        if row["new_custom_id"] != selected["source_id"]:
            raise RuntimeError(f"source mismatch at shard {selected['shard']} row {selected['row']}")
        expected_error = selected["expected"]["kind"] == "error"
        if bool(row["has_error"]) != expected_error:
            raise RuntimeError(f"has_error mismatch for {selected['source_id']}")
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(row["image"]["bytes"]))).convert("RGB")
        image.save(PHOTO_DIR / selected["file"], "JPEG", quality=88, optimize=True)
        records.append({
            "file": selected["file"],
            "sourceId": selected["source_id"],
            "shard": SHARDS[selected["shard"]],
            "rowIndex": selected["row"],
            "grade": row["grade"],
            "domain": row["domain_code"],
            "subdomain": row["subdomain_code"],
            "handwritingStyle": "legible" if row["handwriting_style"] else "challenging",
            "imageQuality": "good" if row["image_quality"] else "challenging",
            "rotation": row["rotation"],
            "annotatorId": row["annot_id"],
            "imageId": row["img_id"],
            "hasError": bool(row["has_error"]),
            "originalQuestion": row["orig_q"],
            "correctSolution": row["orig_a"],
            "perturbedSolution": row["pert_a"],
            "perturbationReasoning": row["pert_reasoning"],
            "expected": selected["expected"],
            "labelRationale": selected["label_rationale"],
        })
    provenance = {
        "dataset": DATASET,
        "revision": REVISION,
        "license": "CC BY 4.0",
        "sourceUrl": f"https://huggingface.co/datasets/{DATASET}",
        "transformation": "Embedded source PNG converted to JPEG quality 88 with EXIF orientation applied; no crop or resize.",
        "shards": [
            {"file": SHARDS[number], "sha256": SHARD_SHA256[number]}
            for number in sorted(SHARDS)
        ],
        "cases": records,
    }
    (GOLDEN_DIR / "fermat-provenance.json").write_text(json.dumps(provenance, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(records)} FERMAT cases")


if __name__ == "__main__":
    main()
