# Análise Completa do Sistema Amanda Chatbot

**Data da Análise:** 15/12/2025  
**Versão Analisada:** Amanda v6.4.3  
**URL:** https://chat3.appamanda.com.br/

---

## 📋 Visão Geral

O Amanda é um chatbot WhatsApp empresarial com foco em automação de atendimento, gerenciamento de tickets e analytics avançado. O sistema possui uma arquitetura modular bem organizada.

---

## 🎯 Estrutura de Navegação

### 1. **GERÊNCIA** (Dashboard Principal)

#### 1.1 Informações Gerais (Cards de Métricas)
- **Tickets Ativos**: Demanda ativa (tickets iniciados pela empresa)
- **Tickets Passivos**: Demanda passiva (tickets iniciados pelo cliente)
- **Em Atendimento**: Atendimentos ativos no momento
- **Aguardando**: Tickets na fila (não atribuídos a atendente)
- **Finalizados**: Tickets fechados e resolvidos no período
- **Mensagens Recebidas**: Total de mensagens recebidas no período
- **Mensagens Enviadas**: Total de mensagens enviadas no período
- **Atendimento**: Tempo médio de atendimento
- **Espera**: Tempo médio de espera na fila
- **Tickets por Dia**: Média diária de tickets no período
- **Novos Contatos**: Novos contatos registrados no período
- **Atendentes Ativos**: Número de atendentes online (ex: 1/11)

#### 1.2 Visão Geral e Avaliações
**Status dos Tickets**
- Gráfico pizza mostrando distribuição de tickets
- Porcentagem de tickets resolvidos (ex: 87%)

**Métricas de Tempo**
- Gráfico de barras comparativo
- Tempo de Atendimento
- Tempo de Espera
- Tempo de Primeira Resposta

**Índice de Avaliação (NPS)**
- Score de NPS (0-10)
- Percentual de tickets avaliados
- Distribuição:
  - Promotores (9-10)
  - Neutros (7-8)
  - Detratores (0-6)

#### 1.3 Mensagens por Período
- Gráfico de linha (hora a hora)
- Mensagens recebidas vs enviadas
- Proporção entre recebidas e enviadas
- Visualização por hora (0h às 23h)

#### 1.4 Atividade por Período e Desempenho

**Atividade Diária**
- Gráfico de barras mostrando tickets por dia
- Total de tickets no período

**Ranking de Contatos (Top 10)**
- Tabela com:
  - Avatar do contato
  - Nome
  - Número de tickets
  - Setor/Fila
  - Tempo total de atendimento

**Ranking de Atendentes**
- Lista ordenável por:
  - Total de Atendimentos
  - Pontuação
  - Atendimentos avaliados
- Métricas por atendente:
  - Pontuação (NPS)
  - Total de atendimentos
  - Atendimentos avaliados
  - Tempo de espera
  - Tempo de atendimento
- Gráfico de barras comparativo

#### 1.5 Distribuição por Canal e Setor

**Distribuição por Canal**
- Gráfico pizza mostrando canais (WhatsApp, etc.)
- Percentual por canal
- Total de tickets

**Distribuição por Setor**
- Gráfico pizza com todos os setores/filas
- Percentual por setor
- Total de tickets por setor
- Setores identificados:
  - Trabalhe Conosco - RH
  - Colab - DP (Férias, Benefícios, Folha, Outros)
  - Cliente - Adm (Fatura, Nota)
  - Cliente - Comercial
  - Colab - RH
  - Quero ser cliente
  - Sem fila

#### 1.6 Atividade por Hora
- Gráfico de barras (0h às 23h)
- Identificação de pico de atendimento
- Exemplo: "Pico: Entre 8h e 10h (14 tickets)"

---

### 2. **ATENDIMENTOS**

Submenu com 7 opções:

#### 2.1 Atendimentos
- Listagem completa de tickets
- Filtros e busca
- Status dos tickets
- Atribuição a atendentes

#### 2.2 Respostas Rápidas
- Mensagens pré-configuradas
- Atalhos para respostas comuns
- Edição e criação de respostas rápidas

#### 2.3 Status
- Gestão de status personalizados de tickets
- Customização de fluxo de status

#### 2.4 Kanban
- Visualização em quadro Kanban
- Arraste e solte tickets entre colunas
- Workflow visual

#### 2.5 Contatos
- Base de contatos
- Histórico de interações
- Informações do cliente
- Tags e segmentação

#### 2.6 Agendamentos
- Agendamento de mensagens
- Lembretes automáticos
- Follow-ups programados

#### 2.7 Tags
- Sistema de etiquetas/tags
- Categorização de tickets
- Filtros por tags

---

### 3. **AUTOMAÇÕES**

Submenu com 3 opções:

#### 3.1 Fluxo de Campanha
- Campanhas automatizadas
- Envio em massa
- Segmentação de público

#### 3.2 Fluxo de Conversa ⭐ (PRINCIPAL)
- **Editor visual de fluxos**
- Criação de fluxos de conversa personalizados
- Importação/Exportação de fluxos (.zip)
- Busca de fluxos
- Funcionalidades:
  - Novo Fluxo
  - Importar (.zip)
  - Buscar fluxos
  - Estado vazio: "Nenhum fluxo criado ainda"
  - Botão: "Criar Primeiro Fluxo"

#### 3.3 Follow UP (Templates)
- Templates de mensagens
- Respostas automáticas
- Mensagens de follow-up

---

### 4. **ADMINISTRAÇÃO**

Submenu com 9 opções:

#### 4.1 API
- Documentação da API
- Tokens de acesso
- Webhooks
- Integração via API REST

#### 4.2 Usuários
- Gestão de usuários do sistema
- Permissões e roles
- Atendentes, gestores, admins

#### 4.3 Config. Aniversário
- Configuração de mensagens de aniversário
- Automação de felicitações
- Personalização de mensagens

#### 4.4 Filas & Chatbot
- Configuração de filas de atendimento
- Regras de distribuição
- Horários de funcionamento
- Mensagens automáticas do chatbot
- Opções de menu

#### 4.5 Lista de Arquivos
- Arquivos enviados/recebidos
- Mídias (imagens, vídeos, documentos)
- Gestão de armazenamento

#### 4.6 Integrações
- Integrações com sistemas externos
- Webhooks
- APIs de terceiros
- CRM, ERP, etc.

#### 4.7 Conexões
- Conexões WhatsApp
- QR Code para autenticação
- Status das conexões
- Múltiplas instâncias

#### 4.8 Financeiro
- Módulo financeiro
- Cobrança
- Planos
- Faturamento

#### 4.9 Configurações
- Configurações gerais do sistema
- Personalizações
- Tema
- Notificações

---

## 🎨 Características de UI/UX

### Design System
- **Cor Principal**: Roxo/Azul vibrante
- **Layout**: Sidebar + Navbar superior
- **Cards de Métricas**: Coloridos com ícones
  - Laranja (Tickets Ativos)
  - Rosa/Magenta (Tickets Passivos)
  - Verde (Em Atendimento)
  - Cinza (Aguardando)
  - Roxo (Finalizados)
- **Gráficos**: Chart.js ou similar
  - Linha (temporal)
  - Pizza (distribuição)
  - Barras (comparação)
- **Estados Vazios**: Ilustrações + mensagens amigáveis
- **Notificações**: Badge com contador no sino
- **Perfil**: Avatar circular com iniciais

### Componentes Principais
1. **Navbar Superior**
   - Logo
   - Menu principal (Gerência, Atendimentos, Automações, Administração)
   - Status de conexão
   - Notificações
   - Perfil do usuário

2. **Filtros**
   - Seletor de data/período
   - Filtros avançados
   - Busca global

3. **Cards de Métricas**
   - Valor principal grande
   - Descrição secundária
   - Ícone ilustrativo
   - Cor de destaque

4. **Tabelas**
   - Paginação
   - Ordenação por coluna
   - Ações inline
   - Hover states

5. **Gráficos**
   - Legendas interativas
   - Tooltips
   - Responsivos
   - Empty states

---

## 🔥 Funcionalidades Premium

### 1. **Sistema de Fluxos Visuais**
- Editor drag-and-drop (presumido)
- Importação/Exportação
- Versionamento
- Templates prontos

### 2. **Analytics Avançado**
- Múltiplos gráficos comparativos
- Rankings e leaderboards
- Análise temporal (hora a hora)
- Segmentação por canal/setor

### 3. **Sistema de Avaliação (NPS)**
- Cálculo automático de NPS
- Segmentação em Promotores/Neutros/Detratores
- Percentual de tickets avaliados

### 4. **Gestão de Filas Inteligente**
- Distribuição automática
- Priorização
- Balanceamento de carga
- SLA tracking

### 5. **Multi-Canal**
- WhatsApp (principal)
- Preparado para outros canais

### 6. **Sistema de Tags**
- Categorização flexível
- Filtros por tags
- Cor-coding

### 7. **Visualização Kanban**
- Workflow visual
- Drag and drop
- Customização de colunas

### 8. **Respostas Rápidas**
- Biblioteca de respostas
- Atalhos de teclado (presumido)
- Variáveis dinâmicas

### 9. **Agendamentos**
- Follow-ups automáticos
- Lembretes
- Campanhas programadas

### 10. **API Completa**
- RESTful API
- Webhooks
- Documentação

---

## 📊 Métricas Rastreadas

### Métricas de Volume
- Total de tickets
- Tickets ativos vs passivos
- Mensagens recebidas vs enviadas
- Novos contatos por período

### Métricas de Performance
- Tempo médio de atendimento
- Tempo médio de espera
- Tempo de primeira resposta
- Taxa de resolução

### Métricas de Qualidade
- NPS (Net Promoter Score)
- Percentual de tickets avaliados
- Distribuição de avaliações
- Taxa de satisfação

### Métricas de Produtividade
- Tickets por atendente
- Atendentes online vs offline
- Performance individual
- Pico de atividades (hora/dia)

### Métricas de Negócio
- Tickets por setor
- Distribuição por canal
- Novos leads/contatos
- Taxa de conversão (presumido)

---

## 🎯 Funcionalidades a Replicar no Nosso Sistema

### ✅ Já Implementadas
1. ✅ Dashboard com métricas básicas
2. ✅ Sistema de tickets
3. ✅ Sessões ativas
4. ✅ Gerenciamento de atendentes
5. ✅ Analytics básico com gráficos
6. ✅ Sistema de fluxos (backend pronto)
7. ✅ Templates de mensagens

### 🔨 A Implementar (Prioridade Alta)

#### 1. **Dashboard Completo Amanda-Style**
- [ ] Cards de métricas coloridos (11 cards)
- [ ] Gráfico de Status dos Tickets (pizza)
- [ ] Gráfico de Métricas de Tempo (barras comparativo)
- [ ] Gráfico de Mensagens por Período (linha hora a hora)
- [ ] Gráfico de Atividade Diária
- [ ] Ranking de Contatos (Top 10)
- [ ] Ranking de Atendentes com gráfico
- [ ] Distribuição por Canal (pizza)
- [ ] Distribuição por Setor (pizza)
- [ ] Atividade por Hora (barras)
- [ ] Filtro de período avançado
- [ ] Botão "Tela Cheia"

#### 2. **Sistema NPS Completo**
- [ ] Solicitação automática de avaliação
- [ ] Cálculo de NPS (Promotores - Detratores / Total * 100)
- [ ] Segmentação Promotores/Neutros/Detratores
- [ ] Widget de NPS no dashboard
- [ ] Relatórios de satisfação

#### 3. **Métricas Avançadas**
- [ ] Tempo de Primeira Resposta
- [ ] Tickets Ativos vs Passivos
- [ ] Proporção Mensagens Recebidas/Enviadas
- [ ] Pico de atividades (identificação automática)
- [ ] Novos contatos por período

#### 4. **Editor Visual de Fluxos**
- [ ] Interface drag-and-drop (React Flow / Vue Flow)
- [ ] Biblioteca de nós/blocos
- [ ] Preview em tempo real
- [ ] Importar/Exportar fluxos (.zip ou .json)
- [ ] Busca de fluxos
- [ ] Duplicar fluxos
- [ ] Testar fluxo (modo teste)

#### 5. **Visualização Kanban**
- [ ] View Kanban para tickets
- [ ] Drag and drop entre colunas
- [ ] Customização de colunas
- [ ] Filtros no Kanban

#### 6. **Respostas Rápidas**
- [ ] CRUD de respostas rápidas
- [ ] Atalhos de teclado
- [ ] Variáveis dinâmicas {{nome}}, {{protocolo}}
- [ ] Categorização de respostas

#### 7. **Sistema de Tags**
- [ ] CRUD de tags
- [ ] Cores personalizadas
- [ ] Múltiplas tags por ticket
- [ ] Filtro por tags
- [ ] Auto-tagging (regras)

#### 8. **Agendamentos**
- [ ] Agendar envio de mensagens
- [ ] Follow-ups automáticos
- [ ] Lembretes
- [ ] Campanhas programadas
- [ ] Calendario visual

#### 9. **Gestão de Contatos Aprimorada**
- [ ] Perfil completo do contato
- [ ] Histórico de interações
- [ ] Notas internas
- [ ] Campos customizados
- [ ] Segmentação/Filtros avançados

#### 10. **Melhorias na Interface**
- [ ] Empty states ilustrados
- [ ] Loading states elegantes
- [ ] Animações suaves
- [ ] Responsividade mobile completa
- [ ] Toast notifications melhoradas
- [ ] Tema claro/escuro persistente

---

## 🎨 Paleta de Cores Amanda

```css
/* Cores Principais */
--primary: #7F3FF2; /* Roxo vibrante */
--secondary: #6366F1; /* Indigo */

/* Métricas */
--tickets-ativos: #FF8A00; /* Laranja */
--tickets-passivos: #E91E63; /* Rosa/Magenta */
--em-atendimento: #00BFA6; /* Verde */
--aguardando: #607D8B; /* Cinza azulado */
--finalizados: #5E35B1; /* Roxo escuro */
--mensagens-recebidas: #424242; /* Cinza escuro */
--mensagens-enviadas: #4CAF50; /* Verde */
--atendimento: #FF9800; /* Laranja */
--espera: #C2185B; /* Rosa escuro */
--tickets-dia: #3F51B5; /* Azul índigo */
--novos-contatos: #00ACC1; /* Ciano */
--atendentes: #43A047; /* Verde */

/* Estados */
--success: #4CAF50;
--warning: #FFC107;
--error: #F44336;
--info: #2196F3;

/* UI */
--background: #F5F7FB;
--surface: #FFFFFF;
--border: #E0E0E0;
--text: #212121;
--text-secondary: #757575;
```

---

## 🚀 Roadmap de Implementação

### Fase 1: Dashboard Avançado (1 semana)
1. Implementar 11 cards de métricas
2. Adicionar gráficos faltantes
3. Criar ranking de contatos
4. Criar ranking de atendentes

### Fase 2: Sistema NPS (3 dias)
1. Modelo de avaliação no banco
2. Solicitação automática pós-atendimento
3. Cálculo de NPS
4. Widget no dashboard

### Fase 3: Editor Visual de Fluxos (2 semanas)
1. Escolher biblioteca (React Flow recomendado)
2. Criar componentes de nós
3. Lógica de conexões
4. Preview e teste
5. Importar/Exportar

### Fase 4: Kanban e Tags (1 semana)
1. View Kanban
2. Sistema de tags
3. Drag and drop

### Fase 5: Respostas Rápidas e Agendamentos (1 semana)
1. CRUD respostas rápidas
2. Sistema de agendamento
3. Follow-ups automáticos

### Fase 6: Refinamentos de UX (1 semana)
1. Empty states
2. Animações
3. Responsividade
4. Performance

---

## 📝 Observações Importantes

1. **Arquitetura Modular**: O Amanda tem uma arquitetura muito bem organizada com separação clara de responsabilidades

2. **Foco em Analytics**: Grande ênfase em métricas e visualizações, fundamental para gestores

3. **UX Premium**: Interface moderna, limpa, com estados vazios bem desenhados

4. **Escalabilidade**: Sistema preparado para múltiplos canais e integrações

5. **Automação**: Forte foco em automação de processos repetitivos

6. **Customização**: Alto nível de personalização (filas, status, tags, etc.)

---

## 🔗 Referências

- Sistema analisado: [Amanda Chatbot](https://chat3.appamanda.com.br/)
- Versão: 6.4.3
- Data: 15/12/2025

---

**Conclusão**: O sistema Amanda é um benchmark excelente de chatbot empresarial. Nossa base já está sólida, mas podemos incorporar várias melhorias de UX, analytics e automação inspiradas nele.

