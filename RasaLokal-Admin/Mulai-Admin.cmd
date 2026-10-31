@echo off
setlocal
cd /d "%~dp0"
title RasaLokal Admin
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js belum tersedia. Pasang Node.js lalu buka kembali file ini.
  pause
  exit /b 1
)
node scripts\dev-server.mjs --open
if errorlevel 1 pause
endlocal
