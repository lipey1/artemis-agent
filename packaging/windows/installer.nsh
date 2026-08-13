; Artemis NSIS hooks — mirror packaging/linux/after-install.sh CLI PATH step.
; electron-builder includes this via nsis.include.

!macro customInstall
  ; Install lowercase `artemis` CLI shim (not Artemis.exe GUI).
  CreateDirectory "$LOCALAPPDATA\artemis\bin"
  IfFileExists "$INSTDIR\resources\artemis.cmd" 0 art_cli_skip_copy
    CopyFiles /SILENT "$INSTDIR\resources\artemis.cmd" "$LOCALAPPDATA\artemis\bin\artemis.cmd"
  art_cli_skip_copy:

  ; Prepend %LOCALAPPDATA%\artemis\bin to User PATH when missing.
  nsExec::ExecToStack 'powershell.exe -NoProfile -Command "$$bin = Join-Path $$env:LOCALAPPDATA \"artemis\\bin\"; $$p = [Environment]::GetEnvironmentVariable(\"Path\",\"User\"); if (-not $$p) { $$p = \"\" }; $$parts = @($$p -split \";\" | Where-Object { $$_ -and $$_.Trim() -ne \"\" }); if (-not ($$parts | Where-Object { $$_.TrimEnd(\"\\/\") -ieq $$bin.TrimEnd(\"\\/\") })) { [Environment]::SetEnvironmentVariable(\"Path\", ($$bin + \";\" + $$p), \"User\") }"'
  Pop $0
  Pop $1
!macroend

!macro customUnInstall
  Delete "$LOCALAPPDATA\artemis\bin\artemis.cmd"
!macroend
