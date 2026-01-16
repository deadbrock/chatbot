@echo off
echo ========================================
echo   LIMPEZA DE SESSAO WHATSAPP
echo ========================================
echo.

echo [1/3] Encerrando processos do Chrome...
taskkill /F /IM chrome.exe /T >nul 2>&1
if %errorlevel%==0 (
    echo       Chrome encerrado com sucesso
) else (
    echo       Nenhum processo do Chrome encontrado
)

echo [2/3] Encerrando processos do Node...
taskkill /F /IM node.exe /T >nul 2>&1
if %errorlevel%==0 (
    echo       Node encerrado com sucesso
) else (
    echo       Nenhum processo do Node encontrado
)

echo [3/3] Limpando pasta de tokens...
if exist "tokens\chatbot-session" (
    rd /s /q "tokens\chatbot-session" >nul 2>&1
    echo       Pasta de tokens limpa
) else (
    echo       Pasta de tokens ja estava limpa
)

echo.
echo ========================================
echo   LIMPEZA CONCLUIDA!
echo ========================================
echo.
echo Agora voce pode rodar: npm start
echo.
pause
