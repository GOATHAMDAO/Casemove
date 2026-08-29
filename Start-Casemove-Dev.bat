@echo off
setlocal
title Casemove - development launcher

cd /d "%~dp0"

if not exist "package.json" (
  echo [ERROR] Put this file in the Casemove project folder.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [ERROR] Dependencies are missing. Run npm install in this folder first.
  pause
  exit /b 1
)

if exist "C:\Program Files\nodejs\npm.cmd" (
  call "C:\Program Files\nodejs\npm.cmd" run start
) else (
  where npm >nul 2>nul
  if errorlevel 1 (
    echo [ERROR] Node.js is not installed. Install the LTS version from nodejs.org.
    pause
    exit /b 1
  )
  call npm run start
)

if errorlevel 1 (
  echo.
  echo Casemove closed with an error.
  rem This launcher is normally started hidden through the shortcut.  Do not
  rem leave an invisible cmd.exe paused after a failed launch.
  if /i "%CASEMOVE_SHOW_ERRORS%"=="1" pause
  exit /b 1
)

endlocal
