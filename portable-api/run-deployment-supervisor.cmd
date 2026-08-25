@echo off
setlocal
cd /d "%~dp0"
node scripts\deployment-supervisor.js
