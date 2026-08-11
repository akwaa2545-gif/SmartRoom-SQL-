@echo off
setlocal
cd /d "%~dp0"
if "%~2"=="" (
  echo Usage: initialize-admin-user.cmd USERNAME SUPER_ADMIN^|APPROVER
  echo Example: initialize-admin-user.cmd admin SUPER_ADMIN
  pause
  exit /b 1
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0initialize-admin-user.ps1" -Username "%~1" -Role "%~2"
pause
