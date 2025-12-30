# ⚡ CORREÇÃO RÁPIDA - 2 MINUTOS

## 🔴 PROBLEMA: URLs erradas causando 404

**Todos os endpoints têm `/api` duplicado:** `/api/api/campaigns`

---

## ✅ SOLUÇÃO RÁPIDA

### **OPÇÃO 1: Find & Replace Global (VSCode)**

1. Abra VSCode
2. Pressione `Ctrl + Shift + H` (Find & Replace em todos os arquivos)
3. **Find:** `apiFetch('/api/`
4. **Replace:** `apiFetch('/`
5. Marque "Regex" se necessário
6. Click "Replace All" (⚠️ Substitui em TODOS os arquivos)

**OU:**

3. **Find:** `apiFetch("/api/`
4. **Replace:** `apiFetch("/`
5. "Replace All"

---

### **OPÇÃO 2: Comando Terminal (Linux/Mac/Git Bash)**

```bash
cd chatbot-whatsapp/src/dashboard/public/app/views
find . -name "*.js" -type f -exec sed -i "s|apiFetch('/api/|apiFetch('/|g" {} \;
```

---

### **OPÇÃO 3: PowerShell (Windows)**

```powershell
cd chatbot-whatsapp\src\dashboard\public\app\views
Get-ChildItem -Filter *.js -Recurse | ForEach-Object {
    (Get-Content $_.FullName) -replace "apiFetch\(['\`"]/api/", "apiFetch('/" | 
    Set-Content $_.FullName
}
```

---

### **OPÇÃO 4: Manual (se preferir)**

Edite estes arquivos em `src/dashboard/public/app/views/`:

1. `campaignsView.js` - Linha ~34
2. `broadcastsView.js` - Linhas ~27, ~41
3. `automationsView.js` - Linha ~84  
4. `chatView.js` - Linha ~236
5. `webhooksView.js` - Linhas ~52, ~83
6. `executiveDashboardView.js` - Linhas ~112, ~127, ~142, ~157
7. `administrationView.js` - Todas as chamadas

**Mude:**
```javascript
apiFetch('/api/campaigns')  // ❌
```

**Para:**
```javascript
apiFetch('/campaigns')  // ✅
```

---

## 🔧 DEPOIS DA CORREÇÃO

```bash
# 1. Reinicie
npm start

# 2. No navegador: Ctrl + Shift + Del (limpar cache)

# 3. Recarregue: Ctrl + Shift + R
```

---

## ✅ TESTE

No console (F12):
```javascript
// Deve funcionar sem 404
apiFetch('/campaigns').then(console.log);
```

---

**Tempo: 2 minutos | Dificuldade: Fácil**

