# Script para limpar sessão do WhatsApp e resolver erro 440
# Execute: .\limpar-sessao.ps1

Write-Host "🔧 LIMPANDO SESSÃO DO WHATSAPP..." -ForegroundColor Cyan
Write-Host ""

# 1. Parar processos Node.js
Write-Host "1️⃣ Parando processos Node.js..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name node -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "   ✅ Processos Node.js encerrados" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Nenhum processo Node.js em execução" -ForegroundColor Gray
}

Start-Sleep -Seconds 2

# 2. Limpar pasta de sessão
Write-Host ""
Write-Host "2️⃣ Limpando pasta .wwebjs_auth..." -ForegroundColor Yellow
if (Test-Path ".wwebjs_auth") {
    Remove-Item -Recurse -Force ".wwebjs_auth"
    Write-Host "   ✅ Pasta .wwebjs_auth removida" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  Pasta .wwebjs_auth não existe" -ForegroundColor Gray
}

# 3. Confirmar limpeza
Write-Host ""
Write-Host "✅ LIMPEZA CONCLUÍDA!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Cyan
Write-Host "   1. Execute: npm start"
Write-Host "   2. Acesse: http://localhost:3001/admin"
Write-Host "   3. Vá em: Administração → Conexões WhatsApp → Nova Conexão"
Write-Host "   4. Escaneie o QR Code novamente"
Write-Host ""
Write-Host "🎉 Pronto! O erro 440 deve estar resolvido." -ForegroundColor Green
Write-Host ""

# Perguntar se quer iniciar o servidor
$resposta = Read-Host "Deseja iniciar o servidor agora? (S/N)"
if ($resposta -eq "S" -or $resposta -eq "s") {
    Write-Host ""
    Write-Host "🚀 Iniciando servidor..." -ForegroundColor Cyan
    npm start
}


