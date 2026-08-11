@echo off
setlocal
cd /d "%~dp0"

if "%~4"=="" (
  echo Usage:
  echo   setup-direct-https.cmd PFX_PATH ALLOWED_NETWORK API_IP API_HOSTNAME
  echo Example:
  echo   setup-direct-https.cmd "C:\Users\user\Downloads\THBTCADT-L04713.KEMET.COM.pfx" 10.249.0.0/16 10.249.160.112 THBTCADT-L04713.KEMET.COM
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-direct-https.ps1" -PfxPath "%~1" -AllowedRemoteAddress "%~2" -ApiIp "%~3" -ApiHostname "%~4"
set "setupExit=%ERRORLEVEL%"
if not "%setupExit%"=="0" (
  echo.
  echo Setup failed with exit code %setupExit%. Read the error above, fix it, then run this file again.
  pause
)
exit /b %setupExit%
