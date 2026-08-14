# Windows GUI update hand-off. Desktop quits, this script runs
# `artemis update` (GitHub Release installer + engine refresh), then relaunches.
param(
  [string]$InstallRoot = "",
  [string]$Branch = "main",
  [int]$DesktopPid = 0,
  [string]$RelaunchExe = ""
)

$ErrorActionPreference = "Continue"
$homeDir = if ($env:ARTEMIS_HOME) { $env:ARTEMIS_HOME } elseif ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "artemis" } else { Join-Path $env:USERPROFILE ".artemis" }
$logDir = Join-Path $homeDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "desktop-update.log"

function Write-UpdateLog([string]$Message) {
  Add-Content -Path $logFile -Value ("{0} {1}" -f (Get-Date -Format "o"), $Message)
}

Write-UpdateLog ("start root={0} branch={1} desktopPid={2} relaunch={3}" -f $InstallRoot, $Branch, $DesktopPid, $RelaunchExe)

if ($DesktopPid -gt 0) {
  try {
    Wait-Process -Id $DesktopPid -Timeout 90 -ErrorAction Stop
    Write-UpdateLog "desktop pid exited"
  } catch {
    Write-UpdateLog "desktop wait skipped: $($_.Exception.Message)"
  }
}

Start-Sleep -Seconds 2

if (-not $InstallRoot) {
  $InstallRoot = Join-Path $homeDir "artemis-agent"
}

$python = Join-Path $InstallRoot "venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  Write-UpdateLog "missing python: $python"
  exit 1
}

$env:ARTEMIS_ENGINE_ROOT = $InstallRoot
$env:ARTEMIS_HOME = $homeDir
Write-UpdateLog "running $python -m artemis_cli.main update --yes --force"
& $python -m artemis_cli.main update --yes --force
$code = $LASTEXITCODE
Write-UpdateLog "update exit $code"

Start-Sleep -Seconds 3
$artemisRunning = Get-Process -Name "Artemis" -ErrorAction SilentlyContinue
if ($RelaunchExe -and (Test-Path $RelaunchExe) -and -not $artemisRunning) {
  Write-UpdateLog "relaunch $RelaunchExe"
  Start-Process -FilePath $RelaunchExe
} else {
  Write-UpdateLog "skip relaunch (running=$([bool]$artemisRunning))"
}

exit $(if ($null -eq $code) { 0 } else { $code })
