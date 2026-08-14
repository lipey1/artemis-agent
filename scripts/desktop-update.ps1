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

Write-UpdateLog ("start root={0} branch={1} desktopPid={2} relaunch={3} pid={4}" -f $InstallRoot, $Branch, $DesktopPid, $RelaunchExe, $PID)

$marker = Join-Path $homeDir ".artemis-update-in-progress"
try {
  $startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  Set-Content -Path $marker -Value ("{0}`n{1}" -f $PID, $startedAt) -Encoding ascii
} catch {
  Write-UpdateLog "marker write skipped: $($_.Exception.Message)"
}

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

# The venv is often still an editable hermes_agent install. Without this,
# `python -m artemis_cli.main` fails in ~100ms (ModuleNotFoundError) and the
# GUI just relaunches the same Artemis.exe.
Set-Location -LiteralPath $InstallRoot
$env:ARTEMIS_ENGINE_ROOT = $InstallRoot
$env:ARTEMIS_HOME = $homeDir
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
if ($env:PYTHONPATH) {
  $env:PYTHONPATH = "$InstallRoot;$($env:PYTHONPATH)"
} else {
  $env:PYTHONPATH = $InstallRoot
}

Write-UpdateLog "cwd=$(Get-Location) pythonpath=$($env:PYTHONPATH)"
Write-UpdateLog "running $python -m artemis_cli.main update --yes --force"
cmd.exe /d /s /c "`"$python`" -m artemis_cli.main update --yes --force" >> $logFile 2>&1
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

try {
  if (Test-Path $marker) {
    $owner = (Get-Content -Path $marker -TotalCount 1 | Out-String).Trim()
    if ($owner -eq [string]$PID) {
      Remove-Item -LiteralPath $marker -Force -ErrorAction SilentlyContinue
    }
  }
} catch {}

exit $(if ($null -eq $code) { 0 } else { $code })
