# Farmácia Faria · Chamadas

## Download for Windows

[Download the Windows 10/11 64-bit ZIP](https://github.com/pika2112/GPT/releases/download/v2.1.0-win10-11/Farmacia-Faria-2.1.0-Windows10-11.zip).

[Windows 8 edition (2.0.5)](https://github.com/pika2112/GPT/releases/download/v2.0.5-faria/Farmacia-Faria-2.0.5-Windows8.zip) remains available separately.

The current edition requires Windows 10 or 11, 64-bit.

Extract **all** files and run `Iniciar.cmd` on the Back Office PC. Keep the application folder together.
No Node.js installation is needed. Read `START-HERE.txt` first.

[Installation and user manual (Portuguese PDF)](https://github.com/pika2112/GPT/releases/download/v2.1.0-win10-11/Manual-Farmacia-Faria-2.1.0.pdf). The same manual and final-test checklist are included in the ZIP.

See `ATUALIZAR.txt` to replace an old version without losing history.

## About the app

Windows Back Office app and browser clients for a shop's local network.
The desktop window closes to the system tray; incoming calls reopen the window
and send a native notification. The main PC must remain awake.

The dashboard focuses on today in the Lisbon time zone. Historical metrics
and records are in a collapsed panel. Incoming calls record their real socket IP;
names can be assigned to computers and used in filters and XLS exports.
A dedicated Definições dialog holds IP/name mappings, Windows startup, sound,
notifications and full backups. Windows startup is also available in the tray menu.

The in-app history survives restarts and supports date/status/post/ID filters,
response-time summaries, pagination, filtered XLS export and a complete JSON backup.

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
This Windows 10/11 build pins Electron 44.7.2. The legacy Windows 8 build
remains available in release 2.0.5; application data paths and schema are unchanged.
The workflow builds and smoke-tests the packaged desktop on a Windows runner,
then publishes the ZIP as a release asset. The exact Windows 10/11 PCs in the pharmacy still require on-site validation.
For a Windows installer, build on Windows with `npm run build:installer`.
Builds are unsigned. Native Windows focus, startup and notification behavior
requires verification on a Windows PC.

See `INSTALACAO.txt` for operating instructions, data location and backups.

Brand artwork: the logo and symbol are converted directly from the user-supplied Illustrator artwork, with original outlined letters.
The alarm pulses red and contains no logo. XLS exports use the bundled SheetJS writer;
see `public/vendor/xlsx-LICENSE.txt`. JSON backups are available only in Definições.

Version 2.0.5 defers historical rendering and Excel loading, caches shared server snapshots,
retries unacknowledged requests without duplicates, distinguishes the calling computer,
and bounds startup logs. See `VALIDATION.txt` for test scope and performance limits.
The final on-site test checklist is in the manual and `TESTE-FINAL.txt`.
