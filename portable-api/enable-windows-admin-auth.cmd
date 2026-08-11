@echo off
setlocal
cd /d "%~dp0"

if "%~5"=="" (
  echo Usage:
  echo   enable-windows-admin-auth.cmd CERTIFICATE_THUMBPRINT ALLOWED_NETWORK API_IP API_HOSTNAME DOMAIN\ADMIN_GROUP
  echo Example:
  echo   enable-windows-admin-auth.cmd ABCDEF1234567890 10.249.0.0/16 10.249.160.112 THBTCADT-L04713.KEMET.COM KEMET\SmartRoom-Admins
  echo.
  echo Run from Command Prompt as Administrator.
  pause
  exit /b 1
)

call "%~dp0setup-host-pc.cmd" "%~1" "%~2" "%~3" "%~4"
if not "%ERRORLEVEL%"=="0" exit /b %ERRORLEVEL%

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0enable-windows-admin-auth.ps1" -AdminGroup "%~5"
set "setupExit=%ERRORLEVEL%"
if not "%setupExit%"=="0" (
  echo.
  echo Admin authentication setup failed with exit code %setupExit%. Read the error above and run this file again.
  pause
)
exit /b %setupExit%
