import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from scripts import frontend_release as release


class FrontendReleaseTest(unittest.TestCase):
    def test_rejects_a_stale_commit_even_on_a_branch_named_main(self):
        current = "1" * 40
        with patch.object(release, "run", return_value=f"{current}\trefs/heads/main\n"):
            release.current_main(current)
            with self.assertRaisesRegex(ValueError, "Stale release"):
                release.current_main("2" * 40)

    def test_rejects_a_main_that_does_not_contain_the_active_release(self):
        with patch.object(release.urllib.request, "urlopen", return_value=io.BytesIO(b'{"status":"diverged"}')):
            with self.assertRaisesRegex(ValueError, "does not descend"):
                release.check_history("1" * 40, "2" * 40)

    def test_checks_entry_and_worker_use_the_same_assets(self):
        index = b'<script src="/assets/index-release.js"></script><link href="/assets/index-release.css">'
        worker = b'assets/index-release.js assets/index-release.css workbox-12345678'
        files = {"assets/index-release.js", "assets/index-release.css", "workbox-12345678.js"}
        self.assertIn("workbox-12345678.js", release.entry_assets(index, worker, files))
        with self.assertRaisesRegex(ValueError, "same assets"):
            release.entry_assets(index, worker.replace(b"index-release.js", b"index-old.js"), files)

    def test_checks_staged_files_and_reuses_matching_production_files(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            stage, dist = root / "stage", root / "dist"
            stage.mkdir()
            dist.mkdir()
            (stage / "index.html").write_bytes(b"new index")
            (dist / "sw.js").write_bytes(b"existing worker")
            files = {
                "index.html": release.digest(b"new index"),
                "sw.js": release.digest(b"existing worker"),
            }
            with patch.object(release, "DIST", dist):
                self.assertEqual(release.plan_release(stage, files), {"index.html": stage / "index.html"})
                (stage / "index.html").write_bytes(b"wrong index")
                with self.assertRaisesRegex(ValueError, "invalid staged file"):
                    release.plan_release(stage, files)

    def test_rejects_paths_outside_the_frontend(self):
        for name in ("../index.html", "/index.html", "assets\\index.js", "C:/index.html"):
            with self.subTest(name=name), self.assertRaisesRegex(ValueError, "Unexpected frontend path"):
                release.file_path(Path("dist"), name)
