@echo off
chcp 65001 >nul
echo ========================================================
echo   Iniciando With Love...
echo   Abriendo navegador en http://localhost:8000/
echo ========================================================
start "" "http://localhost:8000/"
python -m http.server 8000
if %errorlevel% neq 0 (
    echo Python no encontrado, iniciando con Node.js...
    npx -y serve -p 8000 .
)
pause
