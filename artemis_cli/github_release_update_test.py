import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from artemis_cli.github_release_update import (
    _windows_detached_flags,
    parse_version,
    pick_release_asset,
    refresh_cli_entrypoints,
    write_artemis_cmd_shim,
)


class GithubReleaseUpdateTests(unittest.TestCase):
    def test_parse_version(self):
        self.assertGreater(parse_version("0.17.38"), parse_version("0.17.37"))
        self.assertEqual(parse_version("v0.17.37"), parse_version("0.17.37"))

    def test_pick_windows_nsis(self):
        assets = [
            {"name": "SHA256SUMS", "browser_download_url": "https://x/SHA256SUMS"},
            {
                "name": "Artemis-0.17.38-win-x64.exe",
                "browser_download_url": "https://x/Artemis-0.17.38-win-x64.exe",
            },
            {
                "name": "Artemis-0.17.38-win-x64.exe.blockmap",
                "browser_download_url": "https://x/blockmap",
            },
        ]
        picked = pick_release_asset(assets, platform="win32")
        self.assertEqual(picked["name"], "Artemis-0.17.38-win-x64.exe")

    def test_pick_linux_prefers_deb(self):
        assets = [
            {
                "name": "Artemis-0.17.38-linux-x86_64.AppImage",
                "browser_download_url": "https://x/appimage",
            },
            {
                "name": "Artemis-0.17.38-linux-amd64.deb",
                "browser_download_url": "https://x/deb",
            },
        ]
        picked = pick_release_asset(assets, platform="linux")
        self.assertEqual(picked["name"], "Artemis-0.17.38-linux-amd64.deb")

    def test_write_artemis_cmd_shim_invokes_artemis_cli(self):
        with tempfile.TemporaryDirectory() as raw:
            scripts = Path(raw) / "Scripts"
            scripts.mkdir()
            python = scripts / "python.exe"
            python.write_text("", encoding="utf-8")
            dest = write_artemis_cmd_shim(python)
            body = dest.read_text(encoding="ascii")
            self.assertEqual(dest, scripts / "artemis.cmd")
            self.assertIn("-m artemis_cli.main", body)

    def test_refresh_cli_bootstraps_ensurepip_when_pip_missing(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            scripts = root / "venv" / "Scripts"
            scripts.mkdir(parents=True)
            python = scripts / "python.exe"
            python.write_bytes(b"")
            calls: list[list[str]] = []

            def fake_run(cmd, **kwargs):
                argv = [str(part) for part in cmd]
                calls.append(argv)
                if "-m" in argv and "pip" in argv and "--version" in argv:
                    return subprocess.CompletedProcess(cmd, 1, stdout="", stderr="No module named pip")
                return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

            with (
                mock.patch("artemis_cli.github_release_update.subprocess.run", side_effect=fake_run),
                mock.patch("artemis_cli.github_release_update._resolve_uv", return_value=None),
                mock.patch("artemis_cli.github_release_update.sys.platform", "win32"),
            ):
                refresh_cli_entrypoints(root)

            self.assertTrue(any(c[-1] == "--version" for c in calls if "-m" in c and "pip" in c))
            self.assertTrue(any("ensurepip" in c for c in calls))
            self.assertTrue(any("install" in c and "-e" in c for c in calls))
            self.assertFalse(any("No module named pip" in " ".join(c) for c in calls if "install" in c))
            self.assertTrue((scripts / "artemis.cmd").exists())

    def test_refresh_cli_prefers_uv_and_skips_pip(self):
        with tempfile.TemporaryDirectory() as raw:
            root = Path(raw)
            scripts = root / "venv" / "Scripts"
            scripts.mkdir(parents=True)
            (scripts / "python.exe").write_bytes(b"")
            calls: list[list[str]] = []

            def fake_run(cmd, **kwargs):
                argv = [str(part) for part in cmd]
                calls.append(argv)
                return subprocess.CompletedProcess(cmd, 0, stdout="", stderr="")

            with (
                mock.patch("artemis_cli.github_release_update.subprocess.run", side_effect=fake_run),
                mock.patch("artemis_cli.github_release_update._resolve_uv", return_value="C:\\uv.exe"),
                mock.patch("artemis_cli.github_release_update.sys.platform", "win32"),
            ):
                refresh_cli_entrypoints(root)

            self.assertEqual(calls[0][:3], ["C:\\uv.exe", "pip", "install"])
            self.assertFalse(any("pip" in c and "-m" in c for c in calls))

    def test_windows_installer_uses_detached_process_group(self):
        with mock.patch("artemis_cli.github_release_update.sys.platform", "win32"):
            self.assertEqual(_windows_detached_flags(), 0x00000008 | 0x00000200)
        with mock.patch("artemis_cli.github_release_update.sys.platform", "linux"):
            self.assertEqual(_windows_detached_flags(), 0)


if __name__ == "__main__":
    unittest.main()
