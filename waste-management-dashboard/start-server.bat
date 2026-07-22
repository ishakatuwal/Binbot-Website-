@echo off
title EcoPulse Waste Management Server
echo ===================================================
echo   EcoPulse Smart Waste Management System
echo ===================================================
echo   Opening dashboard at http://localhost:8085/
echo   (Keep this window open while using the dashboard)
echo ===================================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0server.ps1"
pause
