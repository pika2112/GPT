# Sistema de Chamadas · Chamadas

## Download for Windows

[Download the Windows 10/11 64-bit ZIP](https://github.com/pika2112/GPT/releases/download/v3.0.0-generico/Sistema-Chamadas-3.0.0-Windows10-11.zip).

The current edition requires Windows 10 or 11, 64-bit.

Extract **all** files and run `SistemaChamadas/Chamadas/Iniciar.cmd` on the Back Office PC. Keep the application folder together.
No Node.js installation is needed. Read `SistemaChamadas/LEIA-PRIMEIRO.txt` first. The application is in `SistemaChamadas/Chamadas/`; the PDF and guides are in `SistemaChamadas/Manuais/`.

[Installation and user manual (Portuguese PDF)](https://github.com/pika2112/GPT/releases/download/v3.0.0-generico/Manual-Sistema-Chamadas-3.0.0.pdf). The same manual and final-test checklist are included in the ZIP.

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
This Windows 10/11 build pins Electron 44.7.2. Application identity and data location are retained for updates from existing installations.
The workflow builds and smoke-tests the packaged desktop on a Windows runner,
then publishes the ZIP as a release asset. The exact Windows 10/11 PCs in the pharmacy still require on-site validation.
For a Windows installer, build on Windows with `npm run build:installer`.
Builds are unsigned. Native Windows focus, startup and notification behavior
requires verification on a Windows PC.

See `INSTALACAO.txt` for operating instructions, data location and backups.

The generic edition uses original neutral blue icons generated locally at build time.
The pharmacy name is configured in Settings, shared by the server and included in JSON backups.

Version 2.0.5 defers historical rendering and Excel loading, caches shared server snapshots,
retries unacknowledged requests without duplicates, distinguishes the calling computer,
and bounds startup logs. See `VALIDATION.txt` for test scope and performance limits.
The final on-site test checklist is in the manual and `TESTE-FINAL.txt`.

Version 3.0.0 remembers the last selected role (Back Office or Colaborador) on
the server, keyed by the real client socket IP. It survives browser and server
restarts, works across browsers, appears in Settings and is included in JSON
backups. Use Mudar de posto to change it. Reserve device IPs; clients sharing
an IP share the preference. Older files load with no role preferences; older
application versions do not preserve the new optional field.

Version 3.0.0 organizes the ZIP into Chamadas (complete application) and Manuais
(documentation), with first-run and update instructions at the package root.
Update only the application folder after JSON backup and complete tray shutdown;
keep the AppData history folder. The workflow inspects the final ZIP and verifies
that every runtime file, launcher and manual is present and user data is absent.

Version 3.0.0 is the generic edition. Configure the name in Definições →
Identificação da farmácia. The shared name appears in every client, window title,
tray tooltip and native/browser notification. Existing history, IP names and role
preferences are preserved. The default is Farmácia. Generated icons and the
updated illustrated manual contain no pharmacy-specific branding.
