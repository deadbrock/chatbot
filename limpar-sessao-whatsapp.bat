@echo off
echo ============================================
echo   LIMPEZA DE SESSAO WHATSAPP - ERRO 440
echo ============================================
echo.

REM Parar o servidor se estiver rodando
echo [1/4] Parando servidor Node.js...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

REM Limpar sessão do Baileys
echo [2/4] Removendo sessao corrompida do Baileys...
if exist ".wwebjs_auth" (
    rmdir /s /q ".wwebjs_auth"
    echo ✓ Sessao Baileys removida
) else (
    echo - Nenhuma sessao Baileys encontrada
)

REM Limpar cache do Node
echo [3/4] Limpando cache...
if exist "node_modules\.cache" (
    rmdir /s /q "node_modules\.cache"
    echo ✓ Cache limpo
)

echo [4/4] Sessao limpa com sucesso!
echo.
echo ============================================
echo   PROXIMO PASSO: INICIAR O SERVIDOR
echo ============================================
echo.
echo Execute: npm run dev
echo.
echo Escaneie o QR Code novamente quando aparecer
echo.
pause

