from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

RELEASE_MANIFEST_PATH = Path(__file__).resolve().parents[3] / "app-release.json"


@lru_cache(maxsize=1)
def get_release_manifest() -> dict[str, Any]:
    with RELEASE_MANIFEST_PATH.open(encoding="utf-8") as release_manifest_file:
        manifest = json.load(release_manifest_file)

    if not isinstance(manifest, dict):
        raise ValueError("Release manifest must be a JSON object.")

    return manifest


def get_current_version() -> str:
    manifest = get_release_manifest()
    version = manifest.get("currentVersion")
    if not isinstance(version, str) or not version.strip():
        raise ValueError("Release manifest must define a non-empty currentVersion.")
    return version
