@echo off
rem Abre la web de guiones. Requiere Node.js y Claude Code (con la sesion iniciada) en este PC.
cd /d "%~dp0"
where node >nul 2>nul || (echo No encuentro Node.js. Instalalo desde https://nodejs.org y vuelve a abrir este archivo. & pause & exit /b 1)
where claude >nul 2>nul || (echo No encuentro Claude Code. Instalalo, inicia sesion una vez y vuelve a abrir este archivo. & pause & exit /b 1)
start "" "http://localhost:3000"
node web\server.js
pause
