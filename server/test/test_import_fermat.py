from __future__ import annotations

import hashlib
import importlib.util
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "import-fermat.py"
SPEC = importlib.util.spec_from_file_location("import_fermat", SCRIPT_PATH)
assert SPEC is not None and SPEC.loader is not None
import_fermat = importlib.util.module_from_spec(SPEC)

pyarrow_stub = types.ModuleType("pyarrow")
pyarrow_stub.__path__ = []
parquet_stub = types.ModuleType("pyarrow.parquet")
pyarrow_stub.parquet = parquet_stub

requests_stub = types.ModuleType("requests")
requests_stub.get = lambda *_args, **_kwargs: None

pil_stub = types.ModuleType("PIL")
pil_stub.__path__ = []
image_stub = types.ModuleType("PIL.Image")
image_ops_stub = types.ModuleType("PIL.ImageOps")
pil_stub.Image = image_stub
pil_stub.ImageOps = image_ops_stub

with patch.dict(sys.modules, {
    "pyarrow": pyarrow_stub,
    "pyarrow.parquet": parquet_stub,
    "requests": requests_stub,
    "PIL": pil_stub,
    "PIL.Image": image_stub,
    "PIL.ImageOps": image_ops_stub,
}):
    SPEC.loader.exec_module(import_fermat)


class FakeResponse:
    def __init__(self, chunks: list[bytes | Exception]) -> None:
        self.chunks = chunks

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *_args: object) -> None:
        return None

    def raise_for_status(self) -> None:
        return None

    def iter_content(self, chunk_size: int):
        assert chunk_size == 1024 * 1024
        for chunk in self.chunks:
            if isinstance(chunk, Exception):
                raise chunk
            yield chunk


class DownloadShardTest(unittest.TestCase):
    def target(self, cache_dir: Path) -> Path:
        return cache_dir / import_fermat.REVISION / import_fermat.SHARDS[0]

    def test_verifies_temporary_download_before_atomic_promotion(self) -> None:
        downloaded = b"verified parquet bytes"
        expected = hashlib.sha256(downloaded).hexdigest()
        with tempfile.TemporaryDirectory() as directory, patch.dict(
            import_fermat.SHARD_SHA256, {0: expected}
        ), patch.object(
            import_fermat.requests, "get", return_value=FakeResponse([downloaded])
        ), patch.object(
            import_fermat, "verify_shard", wraps=import_fermat.verify_shard
        ) as verify:
            cache_dir = Path(directory)
            target = import_fermat.download_shard(0, cache_dir, "secret-token")

            self.assertEqual(target.read_bytes(), downloaded)
            self.assertEqual(verify.call_args_list[0].args[1].name, f"{target.name}.partial")
            self.assertFalse(target.with_name(f"{target.name}.partial").exists())

    def test_checksum_failure_cleans_partial_without_creating_canonical_cache(self) -> None:
        expected = hashlib.sha256(b"expected bytes").hexdigest()
        with tempfile.TemporaryDirectory() as directory, patch.dict(
            import_fermat.SHARD_SHA256, {0: expected}
        ), patch.object(
            import_fermat.requests, "get", return_value=FakeResponse([b"corrupt bytes"])
        ):
            cache_dir = Path(directory)
            target = self.target(cache_dir)

            with self.assertRaisesRegex(RuntimeError, "SHA-256 mismatch"):
                import_fermat.download_shard(0, cache_dir, "secret-token")

            self.assertFalse(target.exists())
            self.assertFalse(target.with_name(f"{target.name}.partial").exists())

    def test_stream_failure_cleans_partial_without_creating_canonical_cache(self) -> None:
        with tempfile.TemporaryDirectory() as directory, patch.object(
            import_fermat.requests,
            "get",
            return_value=FakeResponse([b"prefix", OSError("stream interrupted")]),
        ):
            cache_dir = Path(directory)
            target = self.target(cache_dir)

            with self.assertRaisesRegex(OSError, "stream interrupted"):
                import_fermat.download_shard(0, cache_dir, "secret-token")

            self.assertFalse(target.exists())
            self.assertFalse(target.with_name(f"{target.name}.partial").exists())

    def test_valid_canonical_cache_is_not_replaced_or_downloaded(self) -> None:
        cached = b"known good cached parquet"
        expected = hashlib.sha256(cached).hexdigest()
        with tempfile.TemporaryDirectory() as directory, patch.dict(
            import_fermat.SHARD_SHA256, {0: expected}
        ):
            cache_dir = Path(directory)
            target = self.target(cache_dir)
            target.parent.mkdir(parents=True)
            target.write_bytes(cached)

            with patch.object(import_fermat.requests, "get") as get:
                result = import_fermat.download_shard(0, cache_dir, "secret-token")

            self.assertEqual(result, target)
            self.assertEqual(target.read_bytes(), cached)
            get.assert_not_called()


if __name__ == "__main__":
    unittest.main()
