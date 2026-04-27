import json
from pathlib import Path

import pytest

from app.core import release


def test_should_return_current_version_from_manifest_when_manifest_exists(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    manifest_path = tmp_path / "app-release.json"
    manifest_path.write_text(json.dumps({"currentVersion": "9.9.9"}), encoding="utf-8")

    monkeypatch.setenv(release.RELEASE_MANIFEST_ENV, str(manifest_path))
    release.get_release_manifest.cache_clear()

    assert release.get_current_version() == "9.9.9"

    release.get_release_manifest.cache_clear()


def test_should_fallback_to_configured_version_when_manifest_is_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv(release.RELEASE_MANIFEST_ENV, raising=False)
    monkeypatch.setenv(release.FALLBACK_VERSION_ENV, "2.3.4")
    monkeypatch.setattr(release, "find_release_manifest_path", lambda: None)
    release.get_release_manifest.cache_clear()

    assert release.get_current_version() == "2.3.4"

    release.get_release_manifest.cache_clear()
