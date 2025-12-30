# 🚀 INÍCIO RÁPIDO - CHATBOT FG SERVICES

## ⚡ EM 5 MINUTOS VOCÊ TEM O CHATBOT RODANDO!

---

## 📋 PRÉ-REQUISITOS

✅ Node.js 14+ instalado  
✅ npm ou yarn  
✅ Porta 3001 disponível

---

## 🎯 PASSO A PASSO

### **1️⃣ INSTALAR DEPENDÊNCIAS (se ainda não fez)**

```bash
cd chatbot-whatsapp
npm install
```

### **2️⃣ INICIAR O SERVIDOR**

```bash
npm start
```

Você verá:

```
🚀 Inicializando Baileys WhatsApp Client...
📱 Usando Baileys versão: 6.x.x
✅ Baileys WhatsApp Client inicializado!
🌐 Servidor rodando em http://localhost:3001
```

### **3️⃣ CONECTAR O WHATSAPP**

1. **Abra o navegador**: http://localhost:3001/admin

2. **Faça login** (se necessário)

3. **Vá em**: `Administração` → `Conexões WhatsApp`

4. **Clique em**: `Nova Conexão`

5. **Escaneie o QR Code** com seu WhatsApp:
   - Abra WhatsApp no celular
   - Toque nos 3 pontinhos → Aparelhos conectados
   - Toque em "Conectar um aparelho"
   - Escaneie o QR Code exibido no navegador

6. **Aguarde**: "✅ WhatsApp conectado com sucesso!"

---

## 🎉 PRONTO! AGORA TESTE

### **Envie uma mensagem para o número conectado**

```
Você: Olá

Bot: Olá 😊, seja bem vindo(a) ao atendimento da FG SERVICES
     Excelência para quem faz com excelência
     
     Como posso te chamar?

Você: João

Bot: Selecione a opção que indica seu perfil:
     
     1️⃣ Sou Cliente
     2️⃣ Quero ser cliente
     3️⃣ Colaborador
     4️⃣ Atual fornecedor
     5️⃣ Quero ser fornecedor
     6️⃣ Trabalhe Conosco
     7️⃣ Outros

Você: 1

Bot: Para agilizar o atendimento, compartilhe por 
     gentileza os dados:
     
     📝 Nome
     📞 Telefone
     📧 Email
     🏢 Qual contrato

... e assim por diante!
```

---

## 🔥 TESTANDO HORÁRIO DE ATENDIMENTO

### **Dentro do horário (8h-12h, 13h-17h)**

Fluxo normal funcionando.

### **Fora do horário**

```
Bot: Olá 😊, seja bem vindo(a) ao atendimento da FG SERVICES
     
     ⏰ No momento estamos fora do horário de atendimento.
     
     📅 Nosso horário:
     • 8h às 12h
     • 13h às 17h
     • Segunda a Sexta
     
     Retornaremos: Segunda-feira às 08:00
     
     💬 Deixe sua mensagem que retornaremos assim que possível!
```

---

## 🎯 FLUXOS PRINCIPAIS PARA TESTAR

### **1. Cliente → Manutenção**

```
Digite: 1 (Sou Cliente)
Digite: 1 (Administrativo)  
Digite: 4 (Manutenção)
Digite: 1 (Abrir chamados)
Digite: 1 (Enceradeira)
... preencha os dados
```

### **2. Colaborador → RDV**

```
Digite: 3 (Colaborador)
Digite: 1 (Colaborador)
Digite: 1 (RDV)
→ Transferido para atendente
```

### **3. Fornecedor → Financeiro**

```
Digite: 4 (Atual fornecedor)
Digite: 1 (Financeiro)
Digite: 1 (Contas a pagar)
... informe CNPJ, NF, vencimento
```

### **4. Trabalhe Conosco**

```
Digite: 6
→ Recebe link: https://trabalhe-conosco.vercel.app
```

---

## 🛠️ CONFIGURAÇÕES ÚTEIS

### **Alterar Horário de Atendimento**

Edite: `src/bot/services/scheduleService.js`

```javascript
schedule: {
  morning: { start: { hour: 9, minute: 0 }, end: { hour: 13, minute: 0 } },
  afternoon: { start: { hour: 14, minute: 0 }, end: { hour: 19, minute: 0 } }
}
```

### **Desabilitar Verificação de Horário (dev/testes)**

```javascript
this.businessHours = {
  enabled: false,  // ← mude para false
  // ...
};
```

---

## 📊 VISUALIZAR SESSÕES

### **No banco de dados**

```bash
# Entrar no banco SQLite
sqlite3 .wwebjs_auth/database.sqlite

# Ver todas as sessões
SELECT phone, name, currentFlow, lastInteraction FROM user_sessions;

# Ver sessões ativas
SELECT * FROM user_sessions WHERE isActive = 1;

# Ver avaliações NPS
SELECT phone, name, npsScore FROM user_sessions WHERE npsScore IS NOT NULL;
```

---

## 🐛 PROBLEMAS COMUNS

### **QR Code não aparece**

**Solução**:
1. Pare o servidor (Ctrl+C)
2. Apague a pasta: `.wwebjs_auth`
3. Inicie novamente: `npm start`
4. Tente conectar de novo

### **Bot não responde**

**Verificar**:
1. Servidor está rodando? `npm start`
2. WhatsApp está conectado? (veja os logs)
3. Tabela `user_sessions` existe?

### **Erro "Cannot find module"**

```bash
rm -rf node_modules package-lock.json
npm install
npm start
```

### **Sessão expira rápido**

Sessões expiram após **24h de inatividade**. É normal!

Para resetar manualmente:

```javascript
// No código
await session.reset();
```

---

## 📝 LOGS IMPORTANTES

```bash
# Ver logs em tempo real
tail -f logs/chatbot-*.log

# Ver últimas 50 linhas
tail -n 50 logs/chatbot-*.log

# Buscar erros
grep "ERROR" logs/chatbot-*.log
```

---

## 🎨 PERSONALIZAR MENSAGENS

### **Editar boas-vindas**

`src/bot/flows/flowDefinitions.js`:

```javascript
welcome_message: {
  message: (name) => `Olá ${name} 😊, bem-vindo à SUA EMPRESA!`,
  next: 'ask_name'
}
```

### **Adicionar nova opção no menu**

```javascript
main_menu: {
  message: `...
8️⃣ Nova Opção`,
  
  options: {
    '8': {
      label: 'Nova Opção',
      next: 'novo_fluxo'
    }
  }
}
```

---

## 💡 DICAS PRO

### **1. Testar fluxos rapidamente**

Use comandos diretos:
- `menu` → volta ao menu principal
- `0` → reinicia conversa

### **2. Ver estado da sessão**

```sql
SELECT * FROM user_sessions WHERE phone = '5511999999999';
```

### **3. Forçar transferência para atendente**

```
Digite: atendente
```

### **4. Resetar tudo**

```sql
DELETE FROM user_sessions;
```

---

## 🌟 RECURSOS EXTRAS

### **Formulário Google Forms Integrado**

No fluxo de Manutenção, o bot envia link do Google Forms:
- Edite o link em: `flowDefinitions.js` → `maintenance_menu` → `send_ticket_form`

### **Avaliação NPS**

Ao final de cada atendimento com humano, o bot pede nota de 0 a 10.

### **Sistema de Tags (Menu Path)**

O bot rastreia todo o caminho percorrido pelo usuário:

```javascript
session.menuPath = [
  { menu: 'main_menu', option: '1', timestamp: '...' },
  { menu: 'client_menu', option: '1', timestamp: '...' },
  ...
]
```

---

## 🎯 PRÓXIMA ETAPA: DASHBOARD

Acesse: http://localhost:3001/admin

- **Tickets**: veja conversas em andamento
- **Métricas**: NPS, volume, horários de pico
- **Relatórios**: exportar dados

---

## 🆘 PRECISA DE AJUDA?

### **Leia a documentação completa**:
- `FLUXO_CHATBOT_README.md` - Documentação técnica completa

### **Logs do sistema**:
- `logs/chatbot-*.log`

### **Verificar status**:

```bash
# Servidor rodando?
curl http://localhost:3001/api/status

# WhatsApp conectado?
curl http://localhost:3001/api/whatsapp/status
```

---

## ✅ CHECKLIST FINAL

- [ ] Servidor iniciado (`npm start`)
- [ ] WhatsApp conectado (QR Code escaneado)
- [ ] Testado fluxo "Sou Cliente"
- [ ] Testado horário de atendimento
- [ ] Avaliação NPS funcionando
- [ ] Dashboard acessível

---

## 🎉 PARABÉNS!

Seu **chatbot está funcionando perfeitamente**! 🚀

Agora é só aproveitar e deixar ele trabalhar para você! 💪😊

---

**FG Services - Excelência para quem faz com excelência** ✨

