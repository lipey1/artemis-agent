@echo off
setlocal EnableExtensions EnableDelayedExpansion
REM artemis - Agent CLI on PATH (Windows).
REM   artemis              -> Agent CLI / TUI
REM   artemis desktop|gui  -> Artemis Desktop (installed app when present)
REM Mirrors scripts/artemis (bash) for Windows cmd/PowerShell.

set "PYTHONPATH="
set "PYTHONHOME="

if defined ARTEMIS_HOME (
  set "HOME_DIR=%ARTEMIS_HOME%"
) else if defined LOCALAPPDATA (
  set "HOME_DIR=%LOCALAPPDATA%\artemis"
) else (
  set "HOME_DIR=%USERPROFILE%\.artemis"
)

set "ROOT="
if defined ARTEMIS_ROOT if exist "%ARTEMIS_ROOT%\venv\Scripts\python.exe" set "ROOT=%ARTEMIS_ROOT%"
if not defined ROOT if exist "%HOME_DIR%\artemis-agent\venv\Scripts\python.exe" set "ROOT=%HOME_DIR%\artemis-agent"
if not defined ROOT if exist "%HOME_DIR%\hermes-agent\venv\Scripts\python.exe" set "ROOT=%HOME_DIR%\hermes-agent"
if not defined ROOT if exist "%USERPROFILE%\.artemis\artemis-agent\venv\Scripts\python.exe" set "ROOT=%USERPROFILE%\.artemis\artemis-agent"
if not defined ROOT if exist "%USERPROFILE%\.artemis\hermes-agent\venv\Scripts\python.exe" set "ROOT=%USERPROFILE%\.artemis\hermes-agent"

REM Fast path: plain `artemis desktop` / `artemis gui` -> installed Desktop.
if /I not "%~1"=="desktop" if /I not "%~1"=="gui" goto run_engine

set "REST=%*"
call set "REST=%%REST:*%~1=%%"
if defined REST set "REST=!REST:~1!"
echo !REST!| findstr /I /C:"--source" /C:"--build-only" /C:"--force-build" /C:"--fake-boot" /C:"--skip-build" /C:"--artemis-root" >nul
if not errorlevel 1 goto run_engine

set "DESKTOP_BIN="
if defined ARTEMIS_DESKTOP_BIN if exist "%ARTEMIS_DESKTOP_BIN%" set "DESKTOP_BIN=%ARTEMIS_DESKTOP_BIN%"
if not defined DESKTOP_BIN if defined LOCALAPPDATA if exist "%LOCALAPPDATA%\Programs\Artemis\Artemis.exe" set "DESKTOP_BIN=%LOCALAPPDATA%\Programs\Artemis\Artemis.exe"
if not defined DESKTOP_BIN if exist "%ProgramFiles%\Artemis\Artemis.exe" set "DESKTOP_BIN=%ProgramFiles%\Artemis\Artemis.exe"
if defined DESKTOP_BIN (
  start "" "%DESKTOP_BIN%" !REST!
  exit /b 0
)

:run_engine
if not defined ROOT goto no_engine
if not exist "%ROOT%\venv\Scripts\python.exe" goto no_engine

set "PY=%ROOT%\venv\Scripts\python.exe"
set "ARTEMIS_ENGINE_ROOT=%ROOT%"

if /I "%~1"=="update" (
  echo Artemis updates come from GitHub Releases.
  echo   https://github.com/lipey1/artemis-agent/releases/latest
  echo Download the asset for your OS and install it over the current build.
  exit /b 0
)

if exist "%ROOT%\artemis" (
  "%PY%" "%ROOT%\artemis" %*
  exit /b %ERRORLEVEL%
)
"%PY%" -m artemis_cli.main %*
exit /b %ERRORLEVEL%

:no_engine
echo Artemis engine not found (need a venv at %%LOCALAPPDATA%%\artemis\artemis-agent). 1>&2
echo Open Artemis Desktop once to finish first-run setup. 1>&2
exit /b 1
