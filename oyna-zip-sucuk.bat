@echo off
rem Starts the zip-sucuk dev server and opens it in the browser. Stop with Ctrl+C.
cd /d "%~dp0zip-sucuk"
where npm >nul 2>nul || goto :nonode
if not exist node_modules (
  echo Installing packages, first time only...
  call npm ci || goto :fail
)
call npm run dev -- --open
goto :eof

:nonode
echo Node.js not found. Install the LTS version from https://nodejs.org and try again.
pause
goto :eof

:fail
echo npm ci failed. See the messages above.
pause
