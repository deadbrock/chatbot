# 🔍 DIAGNÓSTICO: Servidor Encerrando Silenciosamente

## ❌ PROBLEMA

O servidor encerra **imediatamente** sem mostrar nenhuma mensagem de erro.

---

## 🧪 TESTES MANUAIS (Execute um por vez)

### **Teste 1: Node.js funciona?**

```powershell
node --version
```

**Resultado esperado:** `v16.x.x` ou superior

---

### **Teste 2: Arquivo server.js existe?**

```powershell
Test-Path src\server.js
```

**Resultado esperado:** `True`

---

### **Teste 3: Sintaxe do server.js está correta?**

```powershell
node --check src\server.js
```

**Resultado esperado:** Nenhuma mensagem (significa OK)
**Se der erro:** Mostra a linha com problema

---

### **Teste 4: Dependências instaladas?**

```powershell
Test-Path node_modules
npm list express sequelize
```

**Resultado esperado:** Lista as versões instaladas

---

### **Teste 5: .env existe?**

```powershell
Test-Path .env
Get-Content .env
```

**Resultado esperado:** Mostra o conteúdo do arquivo

---

### **Teste 6: Tentar importar server.js**

```powershell
node -e "try { console.log('Importando...'); require('./src/server.js'); } catch(e) { console.error('ERRO:', e.message); }"
```

**Resultado esperado:** Deve mostrar a mensagem de erro real

---

### **Teste 7: Ver output completo do npm start**

```powershell
$env:DEBUG="*"; npm start
```

**OU:**

```powershell
node src\server.js 2>&1 | Out-File -FilePath debug-output.txt
Get-Content debug-output.txt
```

---

## 🔧 POSSÍVEIS CAUSAS E SOLUÇÕES

### **Causa 1: Porta 3001 em uso**

**Teste:**
```powershell
netstat -ano | findstr :3001
```

**Se mostrar algo:**
```powershell
# Matar processo (substitua PID pelo número mostrado)
Stop-Process -Id PID -Force

# OU mudar porta no .env
# PORT=3002
```

---

### **Causa 2: Erro de sintaxe em arquivo modificado**

**Verificar arquivos modificados recentemente:**
```powershell
Get-ChildItem src\dashboard\public\app\views\*.js | 
  ForEach-Object { 
    Write-Host "Verificando $_..." 
    node --check $_.FullName 
  }
```

---

### **Causa 3: Módulo faltando**

**Reinstalar dependências:**
```powershell
Remove-Item node_modules -Recurse -Force
Remove-Item package-lock.json -Force
npm install
```

---

### **Causa 4: Arquivo corrompido**

**Verificar integridade:**
```powershell
# Verificar se arquivos principais existem
Test-Path src\server.js
Test-Path src\config\database.js
Test-Path src\models\index.js
Test-Path src\routes\index.js
```

---

## 🚨 SOLUÇÃO EMERGENCIAL

Se nada funcionar, crie um servidor mínimo:

**Arquivo:** `minimal-server.js`

```javascript
const express = require('express');
const app = express();
const PORT = 3001;

app.get('/', (req, res) => {
  res.send('Servidor funcionando!');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
```

**Execute:**
```powershell
node minimal-server.js
```

**Se isso funcionar:** O problema está no código do `server.js`  
**Se isso NÃO funcionar:** O problema é no Node.js ou sistema

---

## 📝 COLE AQUI OS RESULTADOS

Execute **Teste 6** e cole o resultado aqui:

```
[Cole a saída aqui]
```

Execute **Teste 7** e cole o resultado aqui:

```
[Cole a saída aqui]
```

---

## 💡 INFORMAÇÕES ÚTEIS

**Versão do Node:**
```powershell
node --version
npm --version
```

**Sistema Operacional:**
```powershell
[System.Environment]::OSVersion
```

**Espaço em disco:**
```powershell
Get-PSDrive C | Select-Object Used,Free
```

---

**🎯 Execute os testes acima e me envie os resultados!**

