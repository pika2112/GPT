# Farmácia Faria · Chamadas

## Download for Windows

[Download the Windows 8 compatibility ZIP](https://github.com/pika2112/GPT/releases/download/v2.0.3-faria/Farmacia-Faria-2.0.3-Windows8.zip).

The original 2.0.0 portable EXE requires Windows 10 or newer. Use this replacement on Windows 8.

Extract **all** files and run `Iniciar.cmd` on the Back Office PC. Keep the application folder together.
No Node.js installation is needed. Read `START-HERE.txt` first.

See `ATUALIZAR.txt` to replace an old version without losing history.

## About the app

Windows Back Office app and browser clients for a shop's local network.
The desktop window closes to the system tray; incoming calls reopen the window
and send a native notification. The main PC must remain awake.

The dashboard focuses on today in the Lisbon time zone. Historical metrics
and records are in a collapsed panel. Incoming calls record their real socket IP;
names can be assigned to computers and used in filters and CSV exports.
A dedicated Definições dialog holds IP/name mappings, Windows startup, sound,
notifications and full backups. Windows startup is also available in the tray menu.

The in-app history survives restarts and supports date/status/post/ID filters,
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
npm run build:folder
```

The Windows application folder is generated in `dist/win-unpacked/`.
This compatibility build pins Electron 22.3.27, the last series supporting
Windows 7/8/8.1. That runtime is no longer supported for security updates.
The workflow builds and smoke-tests the packaged desktop on a Windows runner,
then publishes the ZIP as a release asset. Windows 8 itself is not tested in CI.
For a Windows installer, build on Windows with `npm run build:installer`.
Builds are unsigned. Native Windows focus, startup and notification behavior
requires verification on a Windows PC.

See `INSTALACAO.txt` for operating instructions, data location and backups.
