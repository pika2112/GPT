@echo off
setlocal
cd /d "%~dp0"
echo Farmacia Faria - Windows 7/8/10/11 64 bits
echo Mantenha todos os ficheiros desta pasta juntos.
echo A iniciar...
set ELECTRON_ENABLE_LOGGING=1
set ELECTRON_ENABLE_STACK_DUMPING=1
"%~dp0Sistema de Chamadas.exe" --enable-logging --log-file="%~dp0diagnostico-electron.log" > "%~dp0diagnostico-console.log" 2>&1
set "CHAMADAS_EXIT_CODE=%ERRORLEVEL%"
echo.
echo A aplicacao terminou. Codigo: %CHAMADAS_EXIT_CODE%
echo Se nao abriu, veja diagnostico-console.log e diagnostico-electron.log.
echo Log da aplicacao: %%APPDATA%%\sistema-chamadas-loja\arranque.log
pause
