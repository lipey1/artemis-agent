import unittest

from artemis_cli.github_release_update import parse_version, pick_release_asset


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


if __name__ == "__main__":
    unittest.main()
