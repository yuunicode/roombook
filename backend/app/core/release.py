from __future__ import annotations

import json
import os
from functools import lru_cache
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as get_installed_version
from pathlib import Path
from typing import Any

RELEASE_MANIFEST_FILENAME = "app-release.json"
RELEASE_MANIFEST_ENV = "ROOMBOOK_RELEASE_MANIFEST_PATH"
FALLBACK_VERSION_ENV = "ROOMBOOK_VERSION"
BACKEND_PACKAGE_NAME = "roombook-backend"


def find_release_manifest_path() -> Path | None:
    configured_path = os.getenv(RELEASE_MANIFEST_ENV, "").strip()
    if configured_path:
        candidate = Path(configured_path).expanduser().resolve()
        if candidate.is_file():
            return candidate

    for parent in Path(__file__).resolve().parents:
        candidate = parent / RELEASE_MANIFEST_FILENAME
        if candidate.is_file():
            return candidate

    return None


def get_fallback_version() -> str:
    configured_version = os.getenv(FALLBACK_VERSION_ENV, "").strip()
    if configured_version:
        return configured_version

    try:
        installed_version = get_installed_version(BACKEND_PACKAGE_NAME).strip()
    except PackageNotFoundError:
        installed_version = ""

    return installed_version or "0.0.0"


@lru_cache(maxsize=1)
def get_release_manifest() -> dict[str, Any]:
    release_manifest_path = find_release_manifest_path()
    if release_manifest_path is None:
        return {"currentVersion": get_fallback_version()}

    with release_manifest_path.open(encoding="utf-8") as release_manifest_file:
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
