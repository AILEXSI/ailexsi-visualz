@echo off
rem Thin wrapper — same as 5.6 local-deploy copy.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0copy-exe.ps1"
exit /b %ERRORLEVEL%
