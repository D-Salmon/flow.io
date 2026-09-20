from pathlib import Path
import gzip
import hashlib
import json
import shutil
import os
import sys
import subprocess

Import("env")


def _gzip_file(src: Path, dst: Path):
    dst.parent.mkdir(parents=True, exist_ok=True)
    with src.open("rb") as in_file, gzip.GzipFile(filename="", mode="wb", fileobj=dst.open("wb"), mtime=0) as out_file:
        shutil.copyfileobj(in_file, out_file)


def _sha256_file(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(128 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_minified_manifest(src_dir: Path):
    manifest_path = src_dir / "webinterface" / ".minified-assets.json"
    if not manifest_path.exists():
        raise RuntimeError(
            "Missing minified web asset manifest. Run: pnpm install --frozen-lockfile && pnpm web:minify"
        )
    payload = json.loads(manifest_path.read_text(encoding="utf-8"))
    assets = payload.get("assets")
    if payload.get("version") != 1 or not isinstance(assets, dict):
        raise RuntimeError(f"Invalid minified web asset manifest: {manifest_path}")
    return assets


project_dir = Path(env.subst("$PROJECT_DIR"))
build_dir = Path(env.subst("$BUILD_DIR"))
src_dir = project_dir / "data"
staging_dir = build_dir / "spiffs_data"
pio_env = str(env.subst("$PIOENV") or "").strip()
cfgdocs_profile = ""
try:
    cfgdocs_profile = str(env.GetProjectOption("custom_cfgdocs_profile") or "").strip().lower()
except Exception:
    cfgdocs_profile = ""


def _run_step(cmd):
    print(f"[prepare_spiffs_data] run: {' '.join(cmd)}")
    step_env = os.environ.copy()
    if pio_env:
        step_env["PIOENV"] = pio_env
    if cfgdocs_profile:
        step_env["FLOW_CFGDOC_PROFILE"] = cfgdocs_profile
    subprocess.run(cmd, cwd=str(project_dir), check=True, env=step_env)

if src_dir.exists():
    transients = (
        project_dir / "data" / "webinterface" / "cfgdocs.json",
        project_dir / "data" / "webinterface" / "cfgmods.json",
        project_dir / "data" / "webinterface" / "cfgdocs.jz",
        project_dir / "data" / "webinterface" / "cfgmods.jz",
    )
    # Ensure a clean state before regeneration.
    for transient in transients:
        if transient.exists():
            transient.unlink()
    _run_step([sys.executable, "scripts/generate_config_docs.py"])
    _run_step([sys.executable, "scripts/generate_cfgdoc_chunks.py"])
    # Keep only segmented cfgdoc assets in source data.
    for transient in transients:
        if transient.exists():
            transient.unlink()
            print(f"[prepare_spiffs_data] removed transient {transient}")

    if staging_dir.exists():
        shutil.rmtree(staging_dir)
    staging_dir.mkdir(parents=True, exist_ok=True)

    compressed_sources = {
        Path("webinterface/index.html"): Path("webinterface/index.html.gz"),
        Path("webinterface/sh.html"): Path("webinterface/sh.html.gz"),
        Path("webinterface/app.js"): Path("webinterface/app.js.gz"),
        Path("webinterface/network.js"): Path("webinterface/network.js.gz"),
        Path("webinterface/activity.js"): Path("webinterface/activity.js.gz"),
        Path("webinterface/io-summary.js"): Path("webinterface/io-summary.js.gz"),
        Path("webinterface/calibration.js"): Path("webinterface/calib.js.gz"),
        Path("webinterface/info.js"): Path("webinterface/info.js.gz"),
        Path("webinterface/logs.js"): Path("webinterface/logs.js.gz"),
        Path("webinterface/updates.js"): Path("webinterface/updates.js.gz"),
        Path("webinterface/pool.js"): Path("webinterface/pool.js.gz"),
        Path("webinterface/config.js"): Path("webinterface/config.js.gz"),
        Path("webinterface/i18n/fr.json"): Path("webinterface/i18n/fr.json.gz"),
        Path("webinterface/i18n/en.json"): Path("webinterface/i18n/en.json.gz"),
        Path("webinterface/app-core.css"): Path("webinterface/app-core.css.gz"),
        Path("webinterface/network.css"): Path("webinterface/network.css.gz"),
        Path("webinterface/activity.css"): Path("webinterface/activity.css.gz"),
        Path("webinterface/io-summary.css"): Path("webinterface/io-summary.css.gz"),
        Path("webinterface/calibration.css"): Path("webinterface/calib.css.gz"),
        Path("webinterface/app-core.js"): Path("webinterface/app-core.js.gz"),
        Path("webinterface/light.html"): Path("webinterface/light.html.gz"),
        Path("webinterface/light.css"): Path("webinterface/light.css.gz"),
        Path("webinterface/light.js"): Path("webinterface/light.js.gz"),
        Path("webinterface/prov.html"): Path("webinterface/prov.html.gz"),
        Path("webinterface/prov.js"): Path("webinterface/prov.js.gz"),
        Path("webinterface/runtimeui.json"): Path("webinterface/runtimeui.json.gz"),
    }
    cfgdoc_dir = src_dir / "wc"
    if cfgdoc_dir.exists():
        for cfgdoc_src in sorted(cfgdoc_dir.glob("*.j")):
            rel = cfgdoc_src.relative_to(src_dir)
            compressed_sources[rel] = rel.with_suffix(".j.gz")
    generated_outputs = set(compressed_sources.values())
    generated_outputs.add(Path("webinterface/.minified-assets.json"))
    # Legacy 3.2.0 development artifact. The shorter config.js filename is
    # required by SPIFFS, whose object names are limited to 31 characters.
    generated_outputs.add(Path("webinterface/configuration.js.gz"))
    generated_outputs.add(Path("webinterface/calibration.css.gz"))
    generated_outputs.add(Path("webinterface/calibration.js.gz"))

    for path in src_dir.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(src_dir)
        if rel.parts[:2] == ("webinterface", "cfgdoc"):
            continue
        if rel in compressed_sources or rel in generated_outputs:
            continue
        dst = staging_dir / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dst)

    minified_assets = _load_minified_manifest(src_dir)
    for src_rel, dst_rel in compressed_sources.items():
        src = src_dir / src_rel
        if not src.exists():
            continue

        if src_rel.parts[0] == "wc":
            # Generated configuration-document chunks are already compact JSON.
            _gzip_file(src, staging_dir / dst_rel)
            continue

        web_rel = src_rel.relative_to("webinterface").as_posix()
        metadata = minified_assets.get(web_rel)
        gzip_src = src.with_name(src.name + ".gz")
        if not isinstance(metadata, dict) or not gzip_src.exists():
            raise RuntimeError(
                f"Missing minified asset for {src_rel}. Run: pnpm web:minify"
            )
        if _sha256_file(src) != metadata.get("source_sha256"):
            raise RuntimeError(
                f"Source changed since minification: {src_rel}. Run: pnpm web:minify"
            )
        if _sha256_file(gzip_src) != metadata.get("gzip_sha256"):
            raise RuntimeError(
                f"Compressed asset does not match its manifest: {gzip_src}"
            )
        destination = staging_dir / dst_rel
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(gzip_src, destination)

    try:
        release_version = str(env.GetProjectOption("custom_version") or "0.0.0")
    except Exception:
        release_version = "0.0.0"
    release_version = release_version.strip().replace("\\", "").strip('"').strip("'")
    release_descriptor = {
        "format": 1,
        "product": "Flow.IO",
        "version": release_version,
        "hardware": "WaveshareESP32S3",
    }
    (staging_dir / "release.json").write_text(
        json.dumps(release_descriptor, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )

    env.Replace(PROJECT_DATA_DIR=str(staging_dir), PROJECTDATA_DIR=str(staging_dir))
    print(f"[prepare_spiffs_data] staging {src_dir} -> {staging_dir}")
