@echo off
REM Run this script from fdat-py/build_specs/ or fdat-py/

if exist "app.py" (
    goto :found
)
if exist "..\app.py" (
    cd ..
    goto :found
)
echo Error: Could not find app.py. Please run from fdat-py/ or fdat-py/build_specs/
exit /b 1

:found
echo Building FDAT for Windows...

rmdir /s /q build dist

REM Note: --add-data separator is ';' on Windows
pyinstaller --noconfirm --clean ^
    --name "FDAT" ^
    --windowed ^
    --icon "assets\assets\icon-128.png" ^
    --add-data "assets;assets" ^
    --hidden-import "lxml" ^
    --hidden-import "lxml.etree" ^
    --hidden-import "lxml._elementpath" ^
    app.py

echo Build complete. Executable is in dist\FDAT\FDAT.exe
