@echo off
rem Menu: pick a game to start. Each game stops with Ctrl+C, then answer N to come back here.
:menu
cls
echo.
echo   1  Ay Kargo
echo   2  Sucuk Hop
echo   3  Oyuncak Kalesi
echo   4  Istasyon
echo   5  Exit
echo.
choice /c 12345 /n /m "  1-5: "
if errorlevel 5 goto :eof
if errorlevel 4 call "%~dp0oyna-istasyon.bat" & goto menu
if errorlevel 3 call "%~dp0oyna-kule.bat" & goto menu
if errorlevel 2 call "%~dp0oyna-zip-sucuk.bat" & goto menu
if errorlevel 1 call "%~dp0oyna-ay-kargo.bat" & goto menu
