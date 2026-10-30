@echo off
title Assurance Media - WhatsApp Multi-Device Gateway (GOWA)
echo =====================================================================
echo   Assurance Media - WhatsApp Multi-Device Gateway (GOWA)
echo   Repository: https://github.com/aldinokemal/go-whatsapp-web-multidevice
echo =====================================================================
echo.
cd /d "%~dp0"

if not exist "windows-amd64.exe" (
    echo [INFO] windows-amd64.exe not found. Downloading v9.7.0 standalone binary...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://github.com/aldinokemal/go-whatsapp-web-multidevice/releases/download/v9.7.0/windows-amd64.exe', 'windows-amd64.exe')"
    if not exist "windows-amd64.exe" (
        echo [ERROR] Failed to download windows-amd64.exe. Please download manually from:
        echo https://github.com/aldinokemal/go-whatsapp-web-multidevice/releases/download/v9.7.0/windows-amd64.exe
        pause
        exit /b 1
    )
    echo [SUCCESS] Download complete!
)

echo Starting standalone gateway server on port 3000 (No Docker required)...
echo Once started, open: http://localhost:3000 in your browser to link device.
echo Press Ctrl+C in this window anytime to stop the gateway.
echo.

windows-amd64.exe rest --port 3000
pause
