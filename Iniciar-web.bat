@echo off
setlocal EnableExtensions
rem Abre la web de guiones. La primera vez instala todo lo que falta (Node, Python, ffmpeg, Claude Code,
rem dependencias de npm y de Python, DeepFilterNet). Las siguientes veces solo abre la web.
cd /d "%~dp0"

rem Recarga el PATH desde el registro: asi se ven Node, Python y ffmpeg recien instalados sin abrir otra ventana.
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "[Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')"`) do set "PATH=%%P"

set "REINICIAR="

if exist ".instalado" goto :arrancar

echo ============================================================
echo  Primera vez: instalando lo que falta. Puede tardar varios
echo  minutos (Python descarga librerias grandes). No cierres esto.
echo ============================================================
echo.

where winget >nul 2>nul
if errorlevel 1 set "SINWINGET=1"

rem --- Node.js ---
where node >nul 2>nul
if errorlevel 1 (
  if defined SINWINGET goto :faltanode
  echo [1/7] Instalando Node.js...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set "REINICIAR=1"
) else (
  echo [1/7] Node.js: ya instalado.
)

rem --- Python 3.13 ---
set "PY="
py -3.13 --version >nul 2>nul && set "PY=py -3.13"
if not defined PY (
  py -3 --version >nul 2>nul && set "PY=py -3"
)
if not defined PY (
  if defined SINWINGET goto :faltapython
  echo [2/7] Instalando Python 3.13...
  winget install -e --id Python.Python.3.13 --accept-source-agreements --accept-package-agreements
  set "REINICIAR=1"
) else (
  echo [2/7] Python: ya instalado ^(%PY%^).
)

rem --- ffmpeg ---
where ffmpeg >nul 2>nul
if errorlevel 1 (
  if defined SINWINGET goto :faltaffmpeg
  echo [3/7] Instalando ffmpeg...
  winget install -e --id Gyan.FFmpeg --accept-source-agreements --accept-package-agreements
  set "REINICIAR=1"
) else (
  echo [3/7] ffmpeg: ya instalado.
)

rem Node, Python o ffmpeg recien instalados no se ven hasta abrir una ventana nueva.
if defined REINICIAR (
  echo.
  echo ============================================================
  echo  Se instalo software nuevo. CIERRA esta ventana y vuelve a
  echo  abrir Iniciar-web.bat para continuar con el resto.
  echo ============================================================
  pause
  exit /b 0
)

rem --- Claude Code ---
where claude >nul 2>nul
if errorlevel 1 (
  echo [4/7] Instalando Claude Code...
  call npm install -g @anthropic-ai/claude-code
  if errorlevel 1 goto :fallo
  set "FALTALOGIN=1"
) else (
  echo [4/7] Claude Code: ya instalado.
)

rem --- Dependencias de Node ---
if not exist "node_modules" (
  echo [5/7] Instalando dependencias de Node ^(npm install^)...
  call npm install
  if errorlevel 1 goto :fallo
) else (
  echo [5/7] Dependencias de Node: ya instaladas.
)

rem --- Entorno de Python ---
if not exist ".venv\Scripts\python.exe" (
  echo [6/7] Creando entorno de Python e instalando librerias...
  %PY% -m venv .venv
  if errorlevel 1 goto :fallo
  ".venv\Scripts\python.exe" -m pip install --upgrade pip
  ".venv\Scripts\python.exe" -m pip install -r pipeline\requirements.txt
  if errorlevel 1 goto :fallo
) else (
  echo [6/7] Entorno de Python: ya creado.
)

rem --- DeepFilterNet (limpieza de voz) ---
if not exist "%USERPROFILE%\.video-cleanup\bin\deep-filter.exe" (
  echo [7/7] Descargando DeepFilterNet...
  call npm run setup-audio -- --yes
  if errorlevel 1 goto :fallo
) else (
  echo [7/7] DeepFilterNet: ya instalado.
)

rem --- Archivo .env ---
if not exist ".env" if exist ".env.example" (
  copy ".env.example" ".env" >nul
  echo.
  echo Cree el archivo .env. Abrelo y pon tus claves: HF_TOKEN, ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID_LAURA.
  start "" notepad ".env"
)

echo ok> ".instalado"
echo.
echo Instalacion terminada.
if defined FALTALOGIN (
  echo.
  echo Falta iniciar sesion en Claude Code: escribe  claude  en una terminal, inicia sesion una vez y cierrala.
  pause
)
echo.

:arrancar
where node >nul 2>nul || (echo No encuentro Node.js. Instalalo desde https://nodejs.org y vuelve a abrir este archivo. & pause & exit /b 1)
where claude >nul 2>nul || (echo No encuentro Claude Code. Instalalo, inicia sesion una vez y vuelve a abrir este archivo. & pause & exit /b 1)
start "" "http://localhost:3000"
node web\server.js
pause
exit /b 0

:faltanode
echo No encuentro Node.js ni winget. Instala Node desde https://nodejs.org y vuelve a abrir este archivo.
pause
exit /b 1
:faltapython
echo No encuentro Python ni winget. Instala Python 3.13 desde https://www.python.org y vuelve a abrir este archivo.
pause
exit /b 1
:faltaffmpeg
echo No encuentro ffmpeg ni winget. Instala ffmpeg desde https://ffmpeg.org y vuelve a abrir este archivo.
pause
exit /b 1
:fallo
echo.
echo Algo fallo en la instalacion ^(mira el mensaje de arriba^). Corrige el problema y vuelve a abrir este archivo: seguira donde lo dejo.
pause
exit /b 1
