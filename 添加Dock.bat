@echo off
cd /d "%~dp0"
setlocal

if "%~1"=="" (
    echo 用法: 把壁纸项目文件夹拖到本文件上, 或:
    echo   添加Dock.bat ^<壁纸目录^> [--from 已有Dock壁纸] [--out 输出名] [--we WE安装目录]
    echo 详见 README.txt
    pause
    exit /b 0
)

if exist "runtime\python.exe" (
    "runtime\python.exe" -X utf8 dock_tool.py %*
) else (
    where python >nul 2>nul
    if errorlevel 1 (
        echo 未找到 Python: 请把 runtime 文件夹放回工具目录, 或安装 Python 3.8+
        pause
        exit /b 1
    )
    python -X utf8 dock_tool.py %*
)
echo.
pause
