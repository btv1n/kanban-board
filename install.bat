@echo off

:: переходит в директорию скрипта
cd /d "%~dp0"

:: проверяет наличие package.json
if not exist "package.json" (
    echo ERROR: package.json not found. Run this .bat from the project folder.
    pause
    exit /b 1
)

:: проверяет доступность npm
where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm not found. Install Node.js and add it to PATH.
    pause
    exit /b 1
)

echo Installing dependencies...
call npm install

set EXITCODE=%errorlevel%
if not "%EXITCODE%"=="0" (
    echo.
    echo npm install failed with code %EXITCODE%.
    pause
    exit /b %EXITCODE%
)

echo.
echo Dependencies installed successfully.
echo You can now run start.bat
pause
exit /b 0
