# Windows GUI update hand-off. Desktop quits, this script runs
# `artemis update` (GitHub Release installer + engine refresh), then relaunches.
param(
  [string]$InstallRoot = "",
  [string]$Branch = "main",
  [int]$DesktopPid = 0,
  [string]$RelaunchExe = ""
)

$ErrorActionPreference = "Continue"

# PowerShell 5.1 on pt-BR Windows uses OEM CP850. Python writes UTF-8
# (PYTHONUTF8=1), so `→` shows up as `ÔåÆ` unless this console is UTF-8 too.
try {
  cmd.exe /d /c "chcp 65001 >NUL"
  $utf8 = New-Object System.Text.UTF8Encoding $false
  [Console]::OutputEncoding = $utf8
  [Console]::InputEncoding = $utf8
  $OutputEncoding = $utf8
} catch {}

$homeDir = if ($env:ARTEMIS_HOME) { $env:ARTEMIS_HOME } elseif ($env:LOCALAPPDATA) { Join-Path $env:LOCALAPPDATA "artemis" } else { Join-Path $env:USERPROFILE ".artemis" }
$logDir = Join-Path $homeDir "logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir "desktop-update.log"

try {
  $Host.UI.RawUI.WindowTitle = "Artemis Update"
  [Console]::Title = "Artemis Update"
  [Console]::ForegroundColor = "White"
  [Console]::BackgroundColor = "Black"
} catch {}

function Write-UpdateLog([string]$Message) {
  Add-Content -Path $logFile -Value ("{0} {1}" -f (Get-Date -Format "o"), $Message)
}

function Write-UpdateStatus([string]$Message, [string]$Color = "White") {
  Write-UpdateLog $Message
  Write-Host $Message -ForegroundColor $Color
}

Write-UpdateStatus ("Artemis Update  root={0}  branch={1}" -f $InstallRoot, $Branch) "Cyan"
Write-UpdateStatus "Keep this window open. Artemis restarts when this finishes." "Yellow"

$marker = Join-Path $homeDir ".artemis-update-in-progress"
try {
  $startedAt = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  Set-Content -Path $marker -Value ("{0}`n{1}" -f $PID, $startedAt) -Encoding ascii
} catch {
  Write-UpdateLog "marker write skipped: $($_.Exception.Message)"
}

if ($DesktopPid -gt 0) {
  Write-UpdateStatus "Waiting for Artemis to close..." "White"
  try {
    Wait-Process -Id $DesktopPid -Timeout 90 -ErrorAction Stop
    Write-UpdateStatus "Artemis closed." "Green"
  } catch {
    Write-UpdateLog "desktop wait skipped: $($_.Exception.Message)"
    Write-Host "Desktop wait skipped: $($_.Exception.Message)" -ForegroundColor DarkYellow
  }
}

Start-Sleep -Seconds 2

if (-not $InstallRoot) {
  $InstallRoot = Join-Path $homeDir "artemis-agent"
}

$python = Join-Path $InstallRoot "venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
  Write-UpdateStatus "Missing python: $python" "Red"
  Start-Sleep -Seconds 8
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
$env:PYTHONUNBUFFERED = "1"
if ($env:PYTHONPATH) {
  $env:PYTHONPATH = "$InstallRoot;$($env:PYTHONPATH)"
} else {
  $env:PYTHONPATH = $InstallRoot
}

Write-UpdateStatus "Installing update..." "Cyan"
Write-UpdateLog "cwd=$(Get-Location) pythonpath=$($env:PYTHONPATH)"
Write-UpdateLog "running $python -u -m artemis_cli.main update --yes --force"
Write-Host ""

# Live console + log. cmd keeps the native exit code; Tee-Object shows lines
# in this window so the user can tell the update is moving.
cmd.exe /d /s /c "`"$python`" -u -m artemis_cli.main update --yes --force" 2>&1 | Tee-Object -FilePath $logFile -Append
$code = $LASTEXITCODE
Write-Host ""
if ($null -eq $code) { $code = 0 }
if ($code -eq 0) {
  Write-UpdateStatus "Update finished." "Green"
} else {
  Write-UpdateStatus "Update finished with exit $code." "Red"
}

Start-Sleep -Seconds 3
$artemisRunning = Get-Process -Name "Artemis" -ErrorAction SilentlyContinue
if ($RelaunchExe -and (Test-Path $RelaunchExe) -and -not $artemisRunning) {
  Write-UpdateStatus "Restarting Artemis..." "Cyan"
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

Start-Sleep -Seconds 2
exit $(if ($null -eq $code) { 0 } else { $code })
