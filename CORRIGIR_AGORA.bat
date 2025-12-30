@echo off
echo ========================================
echo CORRECAO AUTOMATICA DE URLS DA API
echo ========================================
echo.

cd /d "%~dp0"

echo Navegando para pasta de views...
cd src\dashboard\public\app\views

echo.
echo Corrigindo arquivos JavaScript...
echo.

powershell -Command "(Get-Content campaignsView.js) -replace \"apiFetch\('/api/\", \"apiFetch('/\" | Set-Content campaignsView.js"
echo [OK] campaignsView.js

powershell -Command "(Get-Content broadcastsView.js) -replace \"apiFetch\('/api/\", \"apiFetch('/\" | Set-Content broadcastsView.js"
echo [OK] broadcastsView.js

powershell -Command "(Get-Content automationsView.js) -replace \"apiFetch\('/api/\", \"apiFetch('/\" | Set-Content automationsView.js"
echo [OK] automationsView.js

powershell -Command "(Get-Content chatView.js) -replace \"apiFetch\('/api/\", \"apiFetch('/\" | Set-Content chatView.js"
echo [OK] chatView.js

powershell -Command "(Get-Content webhooksView.js) -replace \"apiFetch\('/api/\", \"apiFetch('/\" | Set-Content webhooksView.js"
echo [OK] webhooksView.js

powershell -Command "(Get-Content executiveDashboardView.js) -replace \"apiFetch\('/api/\", \"apiFetch('/\" | Set-Content executiveDashboardView.js"
echo [OK] executiveDashboardView.js

powershell -Command "(Get-Content administrationView.js) -replace \"apiFetch\('/api/\", \"apiFetch('/\" | Set-Content administrationView.js"
echo [OK] administrationView.js

powershell -Command "(Get-Content settingsView.js) -replace \"apiFetch\('/api/\", \"apiFetch('/\" | Set-Content settingsView.js" 2>nul
echo [OK] settingsView.js

echo.
echo ========================================
echo CORRECAO CONCLUIDA!
echo ========================================
echo.
echo Agora execute: npm start
echo.
pause

