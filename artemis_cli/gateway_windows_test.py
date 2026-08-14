import os
import unittest
from unittest import mock

from artemis_cli.gateway_windows import _skip_login_service_install, start


class GatewayWindowsStartTests(unittest.TestCase):
    def test_skip_login_service_install_reads_env(self):
        with mock.patch.dict(os.environ, {"ARTEMIS_GATEWAY_SKIP_SERVICE": "1"}, clear=False):
            os.environ.pop("ARTEMIS_GATEWAY_DETACHED", None)
            self.assertTrue(_skip_login_service_install())
        with mock.patch.dict(os.environ, {"ARTEMIS_GATEWAY_DETACHED": "1"}, clear=False):
            os.environ.pop("ARTEMIS_GATEWAY_SKIP_SERVICE", None)
            self.assertTrue(_skip_login_service_install())
        with mock.patch.dict(
            os.environ,
            {"ARTEMIS_GATEWAY_SKIP_SERVICE": "0", "ARTEMIS_GATEWAY_DETACHED": "0"},
        ):
            self.assertFalse(_skip_login_service_install())

    @mock.patch("artemis_cli.gateway_windows.install")
    @mock.patch("artemis_cli.gateway_windows._report_gateway_start")
    @mock.patch("artemis_cli.gateway_windows._spawn_detached", return_value=4242)
    @mock.patch("artemis_cli.gateway_windows._gateway_pids", return_value=[])
    @mock.patch("artemis_cli.gateway_windows._assert_windows")
    def test_start_skip_service_spawns_without_install(
        self, _assert_windows, _pids, spawn, report, install
    ):
        with mock.patch.dict(os.environ, {"ARTEMIS_GATEWAY_SKIP_SERVICE": "1"}):
            os.environ.pop("ARTEMIS_GATEWAY_DETACHED", None)
            start()

        spawn.assert_called_once_with()
        report.assert_called_once()
        install.assert_not_called()

        spawn.reset_mock()
        report.reset_mock()
        with mock.patch.dict(os.environ, {"ARTEMIS_GATEWAY_DETACHED": "1"}):
            os.environ.pop("ARTEMIS_GATEWAY_SKIP_SERVICE", None)
            start()

        spawn.assert_called_once_with()
        install.assert_not_called()

    @mock.patch("artemis_cli.setup.is_noninteractive", return_value=True)
    @mock.patch("artemis_cli.gateway_windows.install")
    @mock.patch("artemis_cli.gateway_windows.is_startup_entry_installed", return_value=False)
    @mock.patch("artemis_cli.gateway_windows.is_task_registered", return_value=False)
    @mock.patch("artemis_cli.gateway_windows._report_gateway_start")
    @mock.patch("artemis_cli.gateway_windows._spawn_detached", return_value=7)
    @mock.patch("artemis_cli.gateway_windows._gateway_pids", return_value=[])
    @mock.patch("artemis_cli.gateway_windows._assert_windows")
    def test_start_noninteractive_spawns_without_install(
        self,
        _assert_windows,
        _pids,
        spawn,
        report,
        _task,
        _startup,
        install,
        _noninteractive,
    ):
        env = {
            key: value
            for key, value in os.environ.items()
            if key not in {"ARTEMIS_GATEWAY_SKIP_SERVICE", "ARTEMIS_GATEWAY_DETACHED"}
        }
        with mock.patch.dict(os.environ, env, clear=True):
            start()

        spawn.assert_called_once_with()
        report.assert_called_once()
        install.assert_not_called()
