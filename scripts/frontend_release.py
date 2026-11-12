"""Verify and publish a frontend release built from the current GitHub main."""

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import urllib.request
from contextlib import ExitStack
from pathlib import Path, PurePosixPath


REPOSITORY = "wapco-ai/golden_path_frontend"
ORIGIN = f"https://github.com/{REPOSITORY}.git"
ROOT = Path("/opt/golden_path_stack")
DIST = ROOT / "frontend/dist"
STATE = ROOT / "scripts/frontend-release.json"
LIVE_ORIGIN = "http://94.101.176.78"
ENTRY_FILES = ("index.html", "sw.js")
SHA = re.compile(r"[a-f0-9]{40}")
DIGEST = re.compile(r"[a-f0-9]{64}")


def run(*args, timeout=30):
    return subprocess.run(args, check=True, text=True, capture_output=True, timeout=timeout).stdout


def current_main(commit):
    if not SHA.fullmatch(commit):
        raise ValueError("Expected a full Git commit SHA.")
    current = run("git", "ls-remote", "--exit-code", ORIGIN, "refs/heads/main").split()[0]
    if commit != current:
        raise ValueError(f"Stale release {commit}. GitHub main is {current}.")


def check_history(previous, commit):
    if previous is None or previous == commit:
        return
    if not SHA.fullmatch(previous):
        raise ValueError("Invalid previous release SHA.")
    url = f"https://api.github.com/repos/{REPOSITORY}/compare/{previous}...{commit}"
    with urllib.request.urlopen(url, timeout=20) as response:
        status = json.load(response)["status"]
    if status != "ahead":
        raise ValueError(f"Release {commit} does not descend from deployed {previous}.")


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_path(root, name):
    path = PurePosixPath(name)
    if (
        path.is_absolute() or not path.parts or str(path) != name
        or any(part in ("..", ".") for part in path.parts)
        or any(char in name for char in "\\:\n\r\0")
    ):
        raise ValueError(f"Unexpected frontend path {name!r}.")
    result = root
    for part in path.parts:
        result = result / part
        if result.is_symlink():
            raise ValueError(f"Unexpected symlink {result}.")
    return result


def entry_assets(index, worker, files):
    assets = set(re.findall(rb'(?:src|href)="/(assets/index-[\w-]+\.(?:js|css))"', index))
    paths = sorted(path.decode() for path in assets)
    if len(paths) != 2 or {Path(path).suffix for path in paths} != {".js", ".css"}:
        raise ValueError("The built entry must reference one hashed script and stylesheet.")
    if any(path not in files or path.encode() not in worker for path in paths):
        raise ValueError("The built entry and service worker must use the same assets.")
    workers = set(re.findall(rb'workbox-[a-f0-9]{8}', worker))
    if len(workers) != 1:
        raise ValueError("Expected one Workbox runtime.")
    runtime = workers.pop().decode() + ".js"
    if runtime not in files:
        raise ValueError("The Workbox runtime is missing from the release.")
    return [*ENTRY_FILES, *paths, runtime]


def create_manifest(dist, commit, output):
    current_main(commit)
    files = {
        path.relative_to(dist).as_posix(): digest(path.read_bytes())
        for path in sorted(dist.rglob("*")) if path.is_file()
    }
    for name in files:
        file_path(dist, name)
    entry_assets(*(dist.joinpath(name).read_bytes() for name in ENTRY_FILES), files)
    output.write_text(json.dumps({"commit": commit, "files": files}, indent=2) + "\n", encoding="utf-8")


def plan_release(stage, files):
    changes = {}
    for name, expected in files.items():
        if not DIGEST.fullmatch(expected):
            raise ValueError(f"Invalid SHA-256 for {name}.")
        source = file_path(stage, name)
        target = file_path(DIST, name)
        old = target.read_bytes() if target.is_file() else None
        if source.exists() and not source.is_file():
            raise ValueError(f"Unexpected staging entry {name}.")
        if old is not None and digest(old) == expected:
            continue
        if not source.is_file() or digest(source.read_bytes()) != expected:
            raise ValueError(f"Missing or invalid staged file {name}.")
        changes[name] = source
    return changes


def replace_file(path, data, mode=0o644, owner=None):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(dir=path.parent, prefix=".frontend-release-")
    try:
        with os.fdopen(fd, "wb") as target:
            target.write(data)
        os.chmod(temp, mode)
        if owner is not None:
            os.chown(temp, *owner)
        os.replace(temp, path)
    finally:
        Path(temp).unlink(missing_ok=True)


def protect_entries(flag):
    for name in ENTRY_FILES:
        run("chattr", flag, str(DIST / name))


def publish_file(name, data, owner):
    target = DIST / name
    if name in ENTRY_FILES:
        run("chattr", "-i", str(target))
    try:
        replace_file(target, data, owner=owner)
    finally:
        if name in ENTRY_FILES:
            run("chattr", "+i", str(target))


def verify_live(paths, files):
    class DirectOnly(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            raise ValueError(f"Unexpected redirect for {req.full_url}.")

    opener = urllib.request.build_opener(DirectOnly)
    for name in paths:
        with opener.open(f"{LIVE_ORIGIN}/{name}", timeout=15) as response:
            if digest(response.read()) != files[name]:
                raise ValueError(f"Production served unexpected content for {name}.")


def publish(stage):
    import fcntl

    if os.geteuid() != 0 or not re.fullmatch(
        r"/home/ubuntu/deploy_app/frontend-release-[A-Za-z0-9]{8}", str(stage.resolve())
    ):
        raise ValueError("Run the production publisher as root with an approved staging directory.")
    stage = stage.resolve()
    release = json.loads(file_path(stage, "release.json").read_text(encoding="utf-8-sig"))
    commit, files = release["commit"], release["files"]
    current_main(commit)
    with ExitStack() as stack:
        for lock in (ROOT / ".github-code-deploy.lock", ROOT / "frontend/.frontend-deploy.lock"):
            stream = stack.enter_context(lock.open("a"))
            fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        mounted = run(
            "docker", "inspect", "--format",
            '{{range .Mounts}}{{if eq .Destination "/usr/share/nginx/html"}}{{.Source}}{{end}}{{end}}',
            "gp_nginx",
        ).strip()
        if mounted != str(DIST):
            raise ValueError("The production container is serving a different directory.")
        previous = json.loads(STATE.read_text(encoding="utf-8")) if STATE.exists() else {}
        check_history(previous.get("commit"), commit)
        for name, expected in previous.get("entry", {}).items():
            if digest(file_path(DIST, name).read_bytes()) != expected:
                raise ValueError(f"Production entry changed outside the publisher: {name}.")
        changes = plan_release(file_path(stage, "frontend"), files)
        paths = entry_assets(*(
            changes.get(name, DIST / name).read_bytes() for name in ENTRY_FILES
        ), files)
        probe = str(Path(__file__).with_name("production_route_probe.py"))
        before = run("python3", probe, timeout=55)
        current_main(commit)

        backup = Path(tempfile.mkdtemp(prefix="frontend-main-", dir=ROOT / "code-backups"))
        print(f"BACKUP={backup}", flush=True)
        order = [name for name in changes if name not in ENTRY_FILES]
        order.extend(name for name in ENTRY_FILES if name in changes)
        for name in order:
            target = DIST / name
            if target.is_file():
                snapshot = backup / name
                snapshot.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(target, snapshot)
        if STATE.exists():
            shutil.copy2(STATE, backup / "previous-release.json")
        owner = DIST.stat()
        owner = (owner.st_uid, owner.st_gid)
        changed = []
        try:
            for name in order:
                data = changes[name].read_bytes()
                if digest(data) != files[name]:
                    raise ValueError(f"Staged file changed during release: {name}.")
                changed.append(name)
                publish_file(name, data, owner)
            protect_entries("+i")
            verify_live(paths, files)
            if json.loads(run("python3", probe, timeout=55)) != json.loads(before):
                raise ValueError("Production routing or map probes changed during publication.")
            entry = {name: files[name] for name in paths}
            replace_file(STATE, (json.dumps({"commit": commit, "entry": entry}) + "\n").encode())
        except Exception:
            protect_entries("-i")
            try:
                for name in reversed(changed):
                    snapshot = backup / name
                    if snapshot.is_file():
                        replace_file(DIST / name, snapshot.read_bytes(), owner=owner)
                    else:
                        (DIST / name).unlink(missing_ok=True)
            finally:
                protect_entries("+i")
            raise
    print(f"DEPLOY_OK {commit}", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    subcommands = parser.add_subparsers(dest="command", required=True)
    check = subcommands.add_parser("check-main")
    check.add_argument("commit", nargs="?")
    manifest = subcommands.add_parser("manifest")
    manifest.add_argument("dist", type=Path)
    manifest.add_argument("commit")
    manifest.add_argument("output", type=Path)
    deploy = subcommands.add_parser("publish")
    deploy.add_argument("stage", type=Path)
    args = parser.parse_args()
    if args.command == "check-main":
        commit = args.commit or run("git", "rev-parse", "HEAD").strip()
        current_main(commit)
        print(f"MAIN_OK {commit}")
    elif args.command == "manifest":
        create_manifest(args.dist, args.commit, args.output)
    else:
        publish(args.stage)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.SubprocessError) as error:
        raise SystemExit(str(error)) from error
