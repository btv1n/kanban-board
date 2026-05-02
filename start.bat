:: отключаем вывод выполняемых команд
@echo off 

:: переходим в папку с файлом
cd /d "%~dp0" 

:: проверка существования package.json
if not exist "package.json" (
    echo ERROR: package.json not found. Run this .bat from the project folder.
    pause
    exit /b 1
)

:: проверка, установлен ли npm
where npm >nul 2>&1
if errorlevel 1 (
    echo ERROR: npm not found. Install Node.js and add it to PATH.
    pause
    exit /b 1
)

echo Starting API on port 3001
echo Browser will open http://localhost:5173 after a short delay.
echo Press Ctrl+C to stop.
echo.

:: задержка
start "" powershell -NoProfile -WindowStyle Hidden -Command "Start-Sleep -Seconds 5; Start-Process 'http://localhost:5173/'"

:: запускаем dev-сервер
call npm run dev

:: ошибка
set EXITCODE=%errorlevel%
if not "%EXITCODE%"=="0" (
    echo.
    echo Process exited with error code %EXITCODE%.
    pause
)
exit /b %EXITCODE%