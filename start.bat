@echo off
echo ========================================
echo   Chatbot WhatsApp - Iniciando...
echo ========================================
echo.

cd /d "%~dp0"

REM Criar .env automaticamente (dev) se não existir
if not exist ".env" (
    if exist "env.example" (
        echo [0/2] Criando arquivo .env a partir de env.example...
        copy /Y "env.example" ".env" >nul
        echo OK: .env criado. Ajuste PORT/JWT_SECRET conforme necessário.
        echo.
    ) else (
        echo AVISO: env.example nao encontrado. Continuando sem .env...
        echo.
    )
)

echo [1/2] Verificando dependencias...
if not exist "node_modules\" (
    echo ERRO: node_modules nao encontrado!
    echo Execute: npm install
    pause
    exit /b 1
)

echo [2/2] Iniciando servidor...
echo.
node src/server.js

pause

