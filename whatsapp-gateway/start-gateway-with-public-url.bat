@echo off
title Assurance Media - WhatsApp Multi-Device Gateway with Public Tunnel
echo =========================================================================
echo   Assurance Media - WhatsApp Gateway (NO DOCKER NEEDED)
echo   Repository: https://github.com/aldinokemal/go-whatsapp-web-multidevice
echo =========================================================================
echo.
cd /d "%~dp0"

if not exist "windows-amd64.exe" (
    echo [INFO] windows-amd64.exe not found. Downloading v9.7.0 standalone binary...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://github.com/aldinokemal/go-whatsapp-web-multidevice/releases/download/v9.7.0/windows-amd64.exe', 'windows-amd64.exe')"
)

if not exist "cloudflared.exe" (
    echo [INFO] cloudflared.exe not found. Downloading Cloudflare Tunnel binary...
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; (New-Object System.Net.WebClient).DownloadFile('https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe', 'cloudflared.exe')"
)

echo [1/2] Starting WhatsApp Gateway Server on port 3000...
start "GOWA Server (port 3000)" windows-amd64.exe rest --port 3000

echo [2/2] Launching Cloudflare Tunnel for Public HTTPS URL...
echo.
echo =========================================================================
echo   Look below for your public HTTPS link (e.g. https://...trycloudflare.com)
echo   Copy that URL and paste it into Portal: Integrations > WhatsApp Gateway URL!
echo   To Link WhatsApp on your phone: Open http://localhost:3000 in your browser!
echo =========================================================================
echo.

cloudflared.exe tunnel --url http://localhost:3000
pause
