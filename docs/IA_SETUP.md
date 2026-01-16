# 🤖 Configuração do Sistema de IA Inteligente

## O que é o Sistema Híbrido?

O sistema híbrido combina **menus tradicionais** com **Inteligência Artificial** para oferecer a melhor experiência:

- **Usuário digita livremente**: "preciso tirar férias" ao invés de "1"
- **IA entende e direciona**: Automaticamente redireciona para Departamento Pessoal
- **Fallback automático**: Se a IA não tiver certeza, mostra o menu tradicional
- **Sempre funciona**: Mesmo com IA desligada, os menus continuam funcionando

---

## 🚀 Como Ativar

### Passo 1: Obter API Key

Escolha um provedor de IA:

#### **Opção A: OpenAI (Recomendado)**

1. Acesse: https://platform.openai.com/api-keys
2. Crie uma conta (se não tiver)
3. Clique em "Create new secret key"
4. Copie a chave (começa com `sk-proj-...`)

**Custo Estimado:**
- GPT-3.5 Turbo: ~$0.002 por mensagem
- 1.000 mensagens/mês ≈ $2 USD
- 10.000 mensagens/mês ≈ $20 USD

#### **Opção B: Anthropic Claude**

1. Acesse: https://console.anthropic.com/
2. Crie uma conta
3. Gere uma API key
4. Copie a chave (começa com `sk-ant-...`)

**Custo Similar ao OpenAI**

---

### Passo 2: Configurar no Sistema

1. Abra o arquivo `.env` na raiz do projeto
2. Adicione sua API Key:
   ```env
   AI_API_KEY=sk-proj-sua_chave_aqui
   ```
3. Salve o arquivo

---

### Passo 3: Ativar no Painel Admin

1. Acesse o sistema: http://localhost:3001
2. Faça login
3. Vá em **Configurações → IA Inteligente**
4. Ative o toggle **"Ativar Sistema Híbrido"**
5. Configure:
   - **Provider**: OpenAI
   - **Modelo**: GPT-3.5 Turbo (mais rápido e barato)
   - **Confiança Mínima**: 70% (recomendado)
6. Clique em **Salvar Configurações**

---

## 🧪 Testar

No painel de configurações da IA, clique em **"Testar IA"** e digite mensagens como:

- "preciso tirar férias"
- "quero saber sobre meu plano de saúde"
- "equipamento quebrou"
- "quero falar com alguém"

O sistema mostrará:
- Qual intenção foi detectada
- Para qual fluxo redirecionaria
- Nível de confiança (0-100%)
- Tempo de processamento

---

## 📊 Analytics

O painel mostra estatísticas em tempo real:

- **Classificações totais**: Quantas vezes a IA foi usada
- **Taxa de uso**: % de vezes que a IA teve confiança suficiente
- **Por Intenção**: Quais assuntos são mais procurados
- **Por Método**: Se usou keywords (grátis) ou IA (pago)

---

## 🎯 Intenções Disponíveis

O sistema reconhece automaticamente:

| Intenção | Palavras-chave | Destino |
|----------|----------------|---------|
| **DP** | férias, afastamento, benefícios, holerite | Departamento Pessoal |
| **RH** | vaga, emprego, currículo | Recursos Humanos |
| **Financeiro** | pagamento, salário, nota fiscal | Financeiro |
| **Compras** | cotação, pedido, material | Compras |
| **Manutenção** | equipamento, defeito, conserto | Manutenção |
| **Comercial** | contrato, proposta, orçamento | Comercial |
| E mais... | | |

---

## 💰 Custos

### Classificação por Keywords (Grátis)
- 100% gratuito
- Instantâneo (< 10ms)
- Precisão: ~70-80%
- Sempre tenta primeiro

### Classificação por IA (Pago)
- Apenas quando keywords não têm certeza
- ~1-3 segundos
- Precisão: ~95%+
- Custo: $0.001-0.003 por mensagem

**Otimização Inteligente:**
O sistema tenta keywords primeiro (grátis) e só chama a IA se necessário, minimizando custos!

---

## 🔧 Ajustes Finos

### Confiança Mínima

- **50-60%**: Mais agressivo, usa IA com mais frequência
- **70%** (padrão): Balanceado
- **80-90%**: Mais conservador, prefere menus

### Temperature

- **0.1-0.3** (padrão): Mais preciso e consistente
- **0.5-0.7**: Mais criativo, pode variar
- **0.8-1.0**: Muito criativo (não recomendado)

---

## 🆘 Troubleshooting

### "IA está sempre usando fallback"

**Causa**: API Key inválida ou não configurada

**Solução**:
1. Verifique se o `.env` tem `AI_API_KEY=sk-...`
2. Confirme que a chave está correta
3. Reinicie o servidor: `npm start`

### "Muitos custos com IA"

**Solução**:
1. Aumente a "Confiança Mínima" para 80-90%
2. Adicione mais palavras-chave nas intenções
3. Keywords são gratuitas e processadas primeiro

### "IA está errando classificações"

**Solução**:
1. Veja os logs em **IA Inteligente → Analytics**
2. Identifique padrões de erro
3. Adicione palavras-chave específicas
4. Ou ajuste o prompt (código)

---

## 📚 Próximos Passos

1. ✅ Ative e teste com mensagens reais
2. 📊 Monitore analytics por 1 semana
3. 🔧 Ajuste palavras-chave conforme necessário
4. 💰 Acompanhe custos na plataforma da OpenAI
5. 🚀 Aproveite a experiência melhorada!

---

## 🤝 Suporte

Dúvidas? Problemas?

1. Verifique os logs: `src/logs/`
2. Analytics no painel: Configurações → IA Inteligente
3. Teste individual: Botão "Testar IA"

**Sistema sempre funciona**: Mesmo com IA desligada, os menus tradicionais continuam operando normalmente! 🎉

