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
    {
        "source_id": "img_438_pert_3.1", "shard": 1, "row": 136,
        "file": "fermat-img_438_pert_3_1.jpg",
        "expected": {"kind": "error", "errorStepIndex": 3, "tag": "notation-error"},
        "label_rationale": "After valid separation and integration setup, tan^(-1)(x) is changed to the nonequivalent reciprocal x^(-1).",
        "coherence_audit": {
            "firstErrorBasis": "Visible steps 1-2 correctly separate variables and set up both arctangent integrals; step 3 uniquely changes tan^(-1)(x) to x^(-1).",
            "downstreamCoherence": "No later computation follows; the remaining prose only identifies step 3 as the general solution.",
        },
    },
    {
        "source_id": "img_401_pert_3.1", "shard": 1, "row": 128,
        "file": "fermat-img_401_pert_3_1.jpg",
        "expected": {"kind": "error", "errorStepIndex": 4, "tag": "algebraic-slip"},
        "label_rationale": "A previously correct (6x+4) numerator is halved during an algebraic rewrite.",
        "coherence_audit": {
            "firstErrorBasis": "Visible steps 1-3 preserve the logarithmic-differentiation setup and the correct (6x+4) derivative; step 4 first changes it to (3x+2).",
            "downstreamCoherence": "The final line carries the same halved numerator forward without introducing another independent error.",
        },
    },
    {
        "source_id": "img_414_pert_3.1", "shard": 1, "row": 165,
        "file": "fermat-img_414_pert_3_1.jpg",
        "expected": {"kind": "error", "errorStepIndex": 7, "tag": "algebraic-slip"},
        "label_rationale": "The correct logarithm difference is combined with its argument inverted, reversing the sign of the log term.",
        "coherence_audit": {
            "firstErrorBasis": "Visible steps 1-6 give the correct partial fractions and antiderivative; step 7 first inverts (x+1)/(x+3) to (x+3)/(x+1).",
            "downstreamCoherence": "No work follows the erroneous final simplification.",
        },
    },
    {
        "source_id": "img_415_pert_3.1", "shard": 1, "row": 164,
        "file": "fermat-img_415_pert_3_1.jpg",
        "expected": {"kind": "error", "errorStepIndex": 5, "tag": "integration-by-parts-error"},
        "label_rationale": "The final integration-by-parts line replaces cos(x) with sin(x).",
        "coherence_audit": {
            "firstErrorBasis": "Visible steps 1-4 correctly apply integration by parts twice and solve for 2I; step 5 first replaces the established cos(x) term with sin(x).",
            "downstreamCoherence": "The substitution occurs in the final displayed result, with no later computation.",
        },
    },
    {
        "source_id": "img_559_pert_3.1", "shard": 1, "row": 180,
        "file": "fermat-img_559_pert_3_1.jpg",
        "expected": {"kind": "error", "errorStepIndex": 3, "tag": "notation-error"},
        "label_rationale": "The result drops the exponent from 2x^2 to 2x.",
        "coherence_audit": {
            "firstErrorBasis": "Visible steps 1-2 correctly align the subtraction; the result at step 3 first changes 2x^2 to 2x while the other combined terms remain correct.",
            "downstreamCoherence": "Step 3 is the final line, so no later work can contradict or add to the error.",
        },
    },
    {
        "source_id": "img_601_pert_3.1", "shard": 1, "row": 143,
        "file": "fermat-img_601_pert_3_1.jpg",
        "expected": {"kind": "error", "errorStepIndex": 1, "tag": "sign-error"},
        "label_rationale": "The requested fractions follow n/(n+1), but the set-builder denominator changes +1 to -1.",
        "coherence_audit": {
            "firstErrorBasis": "The question is visible step 0; step 1 is the only solution line and first changes the denominator pattern from n+1 to n-1.",
            "downstreamCoherence": "No later computation follows the erroneous set-builder expression.",
        },
    },
    {
        "source_id": "img_459_pert_3.1", "shard": 1, "row": 148,
        "file": "fermat-img_459_pert_3_1.jpg",
        "expected": {"kind": "error", "errorStepIndex": 3, "tag": "notation-error"},
        "label_rationale": "The correctly expanded first matrix entry 12+63 is written as 7^5 instead of 75.",
        "coherence_audit": {
            "firstErrorBasis": "Visible steps 1-2 correctly expand all six dot products; step 3 first writes the correct sum 12+63=75 as the nonequivalent 7^5.",
            "downstreamCoherence": "No work follows the final matrix, and its other five entries remain correct.",
        },
    },
    {
        "source_id": "img_584_pert_3.2", "shard": 1, "row": 219,
        "file": "fermat-img_584_pert_3_2.jpg",
        "expected": {"kind": "error", "errorStepIndex": 2, "tag": "sign-error"},
        "label_rationale": "Evaluating p(2) replaces subtraction with addition.",
        "coherence_audit": {
            "firstErrorBasis": "Visible step 1 defines the polynomial correctly; step 2 first replaces subtraction by addition when evaluating p(2).",
            "downstreamCoherence": "The p(0) check stays correct and the final conclusion consistently follows the erroneous p(2)=8 result.",
        },
    },
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


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_shard(number: int, path: Path) -> Path:
    actual = sha256_file(path)
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
    partial = target.with_name(f"{target.name}.partial")
    partial.unlink(missing_ok=True)
    try:
        with requests.get(url, headers={"Authorization": f"Bearer {token}"}, stream=True, timeout=60) as response:
            response.raise_for_status()
            with partial.open("wb") as output:
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    output.write(chunk)
        verify_shard(number, partial)
        partial.replace(target)
    finally:
        partial.unlink(missing_ok=True)
    return target


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
        output_path = PHOTO_DIR / selected["file"]
        image.save(output_path, "JPEG", quality=88, optimize=True)
        record = {
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
            "outputSha256": sha256_file(output_path),
        }
        if expected_error:
            record["coherenceAudit"] = selected["coherence_audit"]
        records.append(record)
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
