@echo off
setlocal
cd /d "%~dp0"
if not exist ".env" (
  echo Missing portable-api\.env. Copy .env.example to .env and configure it first.
  exit /b 1
)
if not exist "node_modules" (
  echo Missing dependencies. Run install-api.cmd once first.
  exit /b 1
)
node src\server.js
