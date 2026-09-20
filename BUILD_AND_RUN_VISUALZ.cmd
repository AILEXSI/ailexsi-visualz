@echo off
setlocal
title AILEXSI Visualz - Build and Run
cd /d "%~dp0"

if not exist "%~dp0package.json" (
  echo Fehler: package.json fehlt. BUILD_AND_RUN_VISUALZ.cmd muss im Visualz-Repo-Wurzelordner liegen.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo Fehler: Node.js wurde nicht gefunden. Bitte Node.js LTS installieren.
  pause
  exit /b 1
)

call npm run tauri:exe
if errorlevel 1 (
  echo.
  pause
  endlocal
  exit /b 1
)

if exist "%~dp0AILEXSI Visualz.exe" (
  start "" "%~dp0AILEXSI Visualz.exe"
) else (
  echo Warnung: AILEXSI Visualz.exe nicht im Repo-Wurzel gefunden.
  pause
  endlocal
  exit /b 1
)

endlocal
exit /b 0
