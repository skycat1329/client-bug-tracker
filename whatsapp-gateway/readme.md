# WhatsApp Multi-Device Gateway (GOWA) - No Docker Required

This directory contains standalone, zero-dependency Windows binaries to run [`aldinokemal/go-whatsapp-web-multidevice`](https://github.com/aldinokemal/go-whatsapp-web-multidevice) on Windows without Docker or any installations.

---

## Files Included:
- **`windows-amd64.exe`**: Official GOWA v9.7.0 standalone REST API server.
- **`cloudflared.exe`**: Official Cloudflare tunnel binary to give your local server an instant public HTTPS URL without router port forwarding or signup.
- **`start-gateway-with-public-url.bat`**: Double-click to start GOWA AND generate a public HTTPS link for Hostinger cloud portal.
- **`start-whatsapp-gateway.bat`**: Double-click to run locally only on `http://localhost:3000`.

---

## How to Run:
1. **Double-click `start-gateway-with-public-url.bat`**.
2. Two things will happen:
   - GOWA starts on `http://localhost:3000`.
   - Cloudflare Tunnel will print a public HTTPS URL (e.g. `https://xxxx-xxxx.trycloudflare.com`).
3. **Link Your WhatsApp (One-Time Setup)**:
   - Open `http://localhost:3000` in Chrome/Edge.
   - Scan the QR code using WhatsApp on your phone (**WhatsApp > Settings > Linked Devices > Link a Device**).
4. **Connect to Assurance Media Portal**:
   - Go to Assurance Media Portal > **Integrations & Alerts > WhatsApp Gateway**.
   - Paste your public HTTPS URL into **Gateway Base URL**.
   - Click **Save Configuration**.
   - Done! All attendance punches and ticket updates will now dispatch through WhatsApp!
