# Sistema de Chamadas

## Download for Windows

[Download the complete Windows ZIP](https://github.com/pika2112/GPT/raw/refs/heads/main/downloads/Sistema-Chamadas-2.0.0.zip) (87 MB).

Extract the ZIP and run `Sistema-Chamadas-2.0.0-Windows.exe` on the Back Office PC.
No Node.js installation is needed. Read `START-HERE.txt` first.

## About the app

Windows Back Office app and browser clients for a shop's local network.
The desktop window closes to the system tray; incoming calls reopen the window
and send a native notification. The main PC must remain awake.

The in-app history survives restarts and supports date/status/ID filters,
response-time summaries, pagination, filtered CSV export and a complete JSON backup.

## Run from source

Use Node.js 22 or newer:

```sh
npm ci
npm test
npm run desktop
```

For browser/server mode, run `npm start` and open `http://localhost:3000`.
On other computers, open `http://<back-office-ip>:3000` and choose Colaborador.
Allow TCP port 3000 only on the store's trusted private network.
This version has no user authentication.

## Build the Windows app

```sh
npm run build:win
```

The self-contained Windows executable is generated in `dist/`.
For a Windows installer, build on Windows with `npm run build:installer`.
Builds are unsigned. Native Windows focus, startup and notification behavior
requires verification on a Windows PC.

See `INSTALACAO.txt` for operating instructions, data location and backups.
