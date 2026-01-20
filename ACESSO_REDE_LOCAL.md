# 🌐 Guia de Acesso na Rede Local

## Como acessar o chatbot de outro PC na mesma rede

### 📋 Pré-requisitos

1. **Ambos os PCs devem estar na mesma rede Wi-Fi/Ethernet**
2. **Firewall do Windows deve permitir conexões na porta do servidor**

---

## 🔍 Passo 1: Descobrir o IP do PC servidor

No PC onde o servidor está rodando, execute no PowerShell ou CMD:

```powershell
ipconfig | findstr /i "IPv4"
```

Você verá algo como:
```
Endereço IPv4. . . . . . . .  . . . . . . . : 192.168.1.21
```

**Anote o IP principal** (geralmente o primeiro, como `192.168.1.21`)

> 💡 **Dica**: O servidor agora mostra automaticamente o IP na mensagem de inicialização!

---

## 🔥 Passo 2: Configurar o Firewall do Windows

### Opção A: Permitir porta específica (Recomendado)

1. Abra o **Firewall do Windows Defender**
2. Clique em **Configurações Avançadas**
3. Clique em **Regras de Entrada** → **Nova Regra**
4. Selecione **Porta** → **Próximo**
5. Selecione **TCP** e digite a porta (ex: `3000` ou `3001`)
6. Selecione **Permitir a conexão** → **Próximo**
7. Marque todas as opções → **Próximo**
8. Dê um nome (ex: "Chatbot WhatsApp") → **Concluir**

### Opção B: Permitir Node.js (Mais simples)

1. Abra o **Firewall do Windows Defender**
2. Clique em **Permitir um aplicativo pelo firewall**
3. Clique em **Alterar configurações**
4. Clique em **Permitir outro aplicativo**
5. Navegue até: `C:\Program Files\nodejs\node.exe`
6. Adicione e marque **Privado** e **Público**
7. Clique em **OK**

---

## 🌐 Passo 3: Acessar de outro PC

No **outro PC** (na mesma rede), abra o navegador e acesse:

```
http://SEU_IP:PORTA/admin
```

**Exemplo:**
- Se o IP é `192.168.1.21` e a porta é `3000`:
  ```
  http://192.168.1.21:3000/admin
  ```

- Se a porta é `3001`:
  ```
  http://192.168.1.21:3001/admin
  ```

---

## ✅ Verificação

### No PC servidor:
Quando o servidor iniciar, você verá uma mensagem como:

```
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║     🤖 CHATBOT WHATSAPP EMPRESARIAL                  ║
║                                                       ║
║     ✅ Servidor rodando na porta 3000                ║
║                                                       ║
║     📱 ACESSO LOCAL:                                  ║
║     ✅ Dashboard: http://localhost:3000/admin         ║
║                                                       ║
║     🌐 ACESSO NA REDE:                                ║
║     ✅ Dashboard: http://192.168.1.21:3000/admin      ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
```

### No outro PC:
1. Abra o navegador
2. Digite o endereço mostrado em **ACESSO NA REDE**
3. Você deve ver a tela de login do chatbot

---

## 🐛 Solução de Problemas

### ❌ Não consegue acessar de outro PC?

1. **Verifique se ambos estão na mesma rede**
   - Ambos devem estar no mesmo Wi-Fi ou na mesma rede Ethernet

2. **Verifique o firewall**
   - Tente desabilitar temporariamente o firewall para testar
   - Se funcionar, reative e configure a regra corretamente

3. **Verifique o IP**
   - Execute `ipconfig` novamente para confirmar o IP
   - Use o IP que aparece em "Adaptador Ethernet" ou "Wi-Fi" (não "VirtualBox" ou "VMware")

4. **Verifique a porta**
   - Confirme qual porta o servidor está usando (veja a mensagem de inicialização)
   - Se a porta 3000 estiver ocupada, o servidor usa 3001 automaticamente

5. **Teste ping**
   - No outro PC, execute: `ping 192.168.1.21` (substitua pelo IP correto)
   - Se não responder, há problema de rede

6. **Teste acesso local primeiro**
   - No PC servidor, acesse `http://localhost:3000/admin`
   - Se não funcionar localmente, há problema no servidor

---

## 🔒 Segurança

⚠️ **Importante**: O servidor está configurado para aceitar conexões de qualquer IP na rede local. 

Para produção:
- Configure um firewall adequado
- Use HTTPS (certificado SSL)
- Configure autenticação forte
- Considere usar um proxy reverso (nginx, Apache)

---

## 📱 Acesso via celular/tablet

Você também pode acessar de dispositivos móveis na mesma rede Wi-Fi:

1. Descubra o IP do PC servidor (mesmo processo)
2. No celular/tablet, conecte-se à mesma rede Wi-Fi
3. Abra o navegador e acesse: `http://IP:PORTA/admin`

**Exemplo:**
```
http://192.168.1.21:3000/admin
```

---

## 💡 Dicas

- **IP fixo**: Para facilitar, configure um IP fixo no PC servidor nas configurações de rede
- **Bookmark**: Salve o endereço nos favoritos do navegador
- **Porta padrão**: Se possível, mantenha a porta 3000 livre para evitar confusão
