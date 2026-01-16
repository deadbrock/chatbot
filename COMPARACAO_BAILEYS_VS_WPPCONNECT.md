# Comparação: Baileys vs WPPConnect

## Por que o WPPConnect tem mais problemas de processos travados?

### Baileys (antigo)
- ✅ **Sem navegador**: conecta direto via WebSocket
- ✅ **Leve**: ~50MB de RAM
- ✅ **Sem processos órfãos**: quando o Node cai, não deixa Chrome rodando
- ❌ **Menos estável**: conexão cai com mais frequência
- ❌ **Mais banimentos**: WhatsApp detecta mais facilmente

### WPPConnect (atual)
- ✅ **Mais estável**: usa o WhatsApp Web oficial
- ✅ **Menos banimentos**: comportamento mais próximo do usuário real
- ✅ **Mais recursos**: suporta todas as funcionalidades do WhatsApp Web
- ❌ **Pesado**: ~200-300MB de RAM (Chrome + Node)
- ❌ **Processos órfãos**: se o Node cai, o Chrome pode continuar rodando
- ❌ **Locks de arquivos**: pasta `tokens/` pode ficar travada

## Correções Aplicadas

### 1. Limpeza Automática de Processos Órfãos
Adicionei a função `cleanupOrphanedProcesses()` que:
- Verifica se há arquivos de lock na pasta `tokens/`
- Mata processos do Chrome que estão usando a sessão
- Roda **automaticamente** antes de inicializar o WhatsApp
- Roda **automaticamente** após desconectar

### 2. Script Manual de Limpeza
Criado `limpar-whatsapp.bat` para casos extremos:
```cmd
limpar-whatsapp.bat
```

## Quando Usar Cada Um?

### Use WPPConnect (atual) se:
- ✅ Precisa de **estabilidade** (produção)
- ✅ Quer evitar **banimentos**
- ✅ Tem **RAM disponível** (mínimo 2GB)
- ✅ Aceita gerenciar processos do Chrome

### Use Baileys se:
- ✅ Ambiente com **pouca RAM** (< 1GB)
- ✅ Não se importa com **conexões instáveis**
- ✅ Quer algo **mais leve e simples**
- ✅ Aceita risco de **banimento**

## Como Voltar para Baileys (se necessário)

### 1. Instalar Baileys
```bash
npm install @whiskeysockets/baileys
```

### 2. Editar `src/bot/whatsapp.js`
```javascript
// Trocar de:
module.exports = require('./whatsapp-wppconnect');

// Para:
module.exports = require('./whatsapp-baileys');
```

### 3. Criar `src/bot/whatsapp-baileys.js`
(Você teria que criar esse arquivo com a implementação do Baileys)

## Recomendação Atual

**Mantenha o WPPConnect** com as correções aplicadas:
- ✅ Limpeza automática de processos órfãos
- ✅ Timeout aumentado (3 minutos)
- ✅ Servidor não cai se WhatsApp falhar
- ✅ Script `limpar-whatsapp.bat` para emergências

O WPPConnect é **mais estável em produção**, e agora os problemas de processos órfãos estão **automaticamente resolvidos**.

---

**Data**: 2026-01-16  
**Status**: WPPConnect com limpeza automática implementada
