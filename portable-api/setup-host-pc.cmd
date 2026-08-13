@echo off
setlocal
cd /d "%~dp0"

if "%~4"=="" (
  echo Usage:
  echo   setup-host-pc.cmd CERTIFICATE_THUMBPRINT ALLOWED_NETWORK API_IP API_HOSTNAME
  echo Example:
  echo   setup-host-pc.cmd ABCDEF1234567890 10.249.0.0/16 10.249.160.112 THBTCADT-L04713.KEMET.COM
  echo.
  echo The certificate must be installed in Local Computer\Personal and trusted by client PCs.
  pause
  exit /b 1
)

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-host-pc.ps1" -CertificateThumbprint "%~1" -AllowedRemoteAddress "%~2" -ApiIp "%~3" -ApiHostname "%~4"
set "setupExit=%ERRORLEVEL%"
if not "%setupExit%"=="0" (
  echo.
  echo Setup failed with exit code %setupExit%. Read the error above, fix it, then run this file again.
  pause
)
exit /b %setupExit%
