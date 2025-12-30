/**
 * Mensagens padrão do chatbot
 */

module.exports = {
  // Mensagens de boas-vindas
  welcome: {
    first_time: `🤖 *Olá! Bem-vindo(a)!*

Eu sou o assistente virtual e vou te ajudar rapidinho.

✅ *Atendo 24/7* para:
- Direcionar você ao *departamento certo*
- Registrar solicitações com *protocolo*
- Conectar com *atendente humano* quando precisar

Para começar, digite *menu* (recomendado) ou descreva seu pedido em 1 frase.`,

    returning: (name) => `🤖 Olá novamente, *${name}*! 

Como posso ajudar você hoje?

Digite *menu* para ver as opções ou me conte sua necessidade! 😊`
  },

  // Menu principal
  mainMenu: `*📋 MENU PRINCIPAL*

Escolha uma opção (digite o número):

*1*  🏢 Departamentos
*2*  🎫 Consultar protocolo
*3*  👤 Falar com atendente
*4*  ❓ Perguntas frequentes
*5*  ⭐ Avaliar atendimento
*0*  🔄 Reiniciar

Dica: você também pode escrever algo como “*rastrear pedido*”, “*orçamento*”, “*suporte TI*”, “*nota fiscal*”.`,

  // Mensagens de erro
  error: {
    general: '❌ Desculpe, ocorreu um erro. Por favor, tente novamente.',
    invalid_option: '❌ Opção inválida. Por favor, escolha uma opção do menu.',
    not_understood: '🤔 Não entendi direitinho.\n\nPode me dizer em 1 frase o que você precisa?\nEx: “rastrear pedido”, “falar com RH”, “preciso de manutenção”.\n\nOu digite *menu* para ver as opções.',
    timeout: '⏱️ Tempo esgotado! Digite *menu* para recomeçar.',
    department_closed: (dept, hours) => `🔴 O departamento de *${dept}* está fechado no momento.\n\n⏰ Horário de atendimento: ${hours}\n\nPosso transferir para outro departamento ou você pode deixar uma mensagem que retornaremos em breve!`
  },

  // Mensagens de sucesso
  success: {
    ticket_created: (protocol) => `✅ *Protocolo criado com sucesso!*\n\n🎫 Número: *${protocol}*\n\nGuarde este número para acompanhar seu atendimento.\n\nVocê receberá atualizações por aqui! 📱`,
    transferred: (dept) => `✅ Transferindo para *${dept}*...\n\nAguarde um momento, por favor! ⏳`,
    scheduled: (date, time) => `✅ *Agendamento confirmado!*\n\n📅 Data: ${date}\n⏰ Horário: ${time}\n\nVocê receberá uma confirmação 24h antes! 🔔`
  },

  // Mensagens de atendimento humano
  human: {
    connecting: '👤 Certo — vou te conectar com um atendente humano.\n\n⏳ Só um instante...',
    connected: (agent) => `✅ *${agent}* assumiu seu atendimento!\n\nFique à vontade para conversar. 😊`,
    queue: (position) => `⏳ Todos os nossos atendentes estão ocupados no momento.\n\nVocê é o *${position}º* da fila.\n\nTempo estimado: *${position * 3} minutos*\n\nAguarde que logo te atenderemos! 🙏`,
    unavailable: '❌ Nenhum atendente disponível no momento.\n\nPosso:\n• Abrir um chamado para você\n• Agendar um atendimento\n• Responder dúvidas frequentes\n\nO que prefere?'
  },

  // Mensagens de finalização
  closing: {
    confirm: '❓ Deseja finalizar este atendimento?\n\n*1.* ✅ Sim\n*2.* ❌ Não',
    finished: '✅ *Atendimento finalizado!*\n\nFoi um prazer ajudar você! 😊\n\nDigite *menu* quando precisar de algo.',
    rating: '⭐ *Como foi seu atendimento?*\n\nAvalie de 1 a 5:\n\n*1* - Péssimo 😞\n*2* - Ruim 😕\n*3* - Regular 😐\n*4* - Bom 😊\n*5* - Excelente 🤩',
    thanks: (rating) => {
      if (rating >= 4) {
        return '🤩 *Obrigado pela avaliação!*\n\nFicamos felizes em ajudar!\n\nVolte sempre! 💚';
      } else if (rating === 3) {
        return '😊 *Obrigado pelo feedback!*\n\nVamos trabalhar para melhorar!\n\nVolte sempre! 💙';
      } else {
        return '😔 *Sentimos muito pela experiência!*\n\nSeu feedback é muito importante para melhorarmos.\n\nUm gestor entrará em contato em breve. 🙏';
      }
    }
  },

  // FAQ
  faq: {
    menu: `*❓ PERGUNTAS FREQUENTES*

*1.* Horário de atendimento
*2.* Como rastrear pedido
*3.* Formas de pagamento
*4.* Política de devolução
*5.* Trabalhe conosco
*6.* Onde estamos localizados
*0.* Voltar ao menu

Digite o número da pergunta:`,

    answers: {
      1: `⏰ *HORÁRIO DE ATENDIMENTO*\n\n📞 Atendimento Geral:\nSegunda a Sexta: 8h às 18h\nSábado: 8h às 12h\n\n🚚 Logística:\nSegunda a Sábado: 7h às 19h\n\n💻 Suporte TI:\nSegunda a Sexta: 8h às 18h\n\n_Fora destes horários, deixe sua mensagem que retornaremos!_`,
      
      2: `📦 *RASTREAMENTO DE PEDIDO*\n\nPara rastrear seu pedido:\n\n1. Digite *rastrear*\n2. Informe o número do pedido\n3. Receba as informações em tempo real\n\nOu acesse: www.suaempresa.com/rastreio`,
      
      3: `💳 *FORMAS DE PAGAMENTO*\n\n✅ Cartão de Crédito (até 12x)\n✅ Cartão de Débito\n✅ PIX\n✅ Boleto Bancário\n✅ Transferência Bancária\n\n_Para empresas: consulte condições especiais!_`,
      
      4: `🔄 *POLÍTICA DE DEVOLUÇÃO*\n\nVocê tem até *7 dias* para devolver produtos.\n\n📋 Condições:\n• Produto sem uso\n• Embalagem original\n• Nota fiscal\n\n📞 Entre em contato com nosso departamento comercial para iniciar o processo!`,
      
      5: `💼 *TRABALHE CONOSCO*\n\nEstamos sempre em busca de talentos!\n\n📧 Envie seu currículo:\nrh@suaempresa.com\n\nOu acesse:\nwww.suaempresa.com/carreiras\n\n🔔 Acompanhe nossas vagas abertas!`,
      
      6: `📍 *NOSSA LOCALIZAÇÃO*\n\n🏢 Endereço:\nRua Exemplo, 123\nBairro - Cidade/UF\nCEP: 00000-000\n\n📞 Telefone: (XX) XXXX-XXXX\n📧 Email: contato@suaempresa.com\n🌐 Site: www.suaempresa.com`
    }
  },

  // Comandos especiais
  commands: {
    help: `*🤖 COMANDOS DISPONÍVEIS*\n\n*menu* - Menu principal\n*departamentos* - Lista de departamentos\n*protocolo* - Consultar protocolo\n*atendente* - Falar com humano\n*rastrear* - Rastrear pedido\n*faq* - Perguntas frequentes\n*avaliar* - Avaliar atendimento\n*cancelar* - Cancelar operação\n*sair* - Finalizar atendimento`,
    
    cancelled: '❌ Operação cancelada!\n\nDigite *menu* para ver as opções.',
    
    unknown_command: '❓ Não reconheci esse comando.\n\nDigite *help* para ver os comandos disponíveis.'
  },

  // Mensagens de áudio
  audio: {
    processing: '🎤 Processando seu áudio...\n\nAguarde um momento! ⏳',
    transcribed: (text) => `✅ Entendi: "${text}"\n\nProcessando sua solicitação...`,
    error: '❌ Não consegui processar o áudio.\n\nPor favor, tente novamente ou digite sua mensagem.'
  },

  // Mensagens de documento
  document: {
    received: '📄 Documento recebido!\n\nEstou processando... ⏳',
    processed: '✅ Documento processado com sucesso!\n\nProtocolo anexado ao seu atendimento.',
    error: '❌ Erro ao processar documento.\n\nFormatos aceitos: PDF, DOC, DOCX, JPG, PNG (máx. 10MB)'
  },

  // Mensagens de agendamento
  scheduling: {
    start: '📅 *AGENDAMENTO*\n\nVamos agendar seu atendimento!\n\nQual o melhor dia? (Ex: 15/12/2024)',
    time: '⏰ Qual o melhor horário?\n\nHorários disponíveis:\n• 09:00\n• 10:00\n• 11:00\n• 14:00\n• 15:00\n• 16:00\n\nDigite o horário desejado:',
    confirm: (date, time) => `✅ *CONFIRMAR AGENDAMENTO*\n\n📅 Data: ${date}\n⏰ Horário: ${time}\n\nConfirma?\n\n*1.* Sim\n*2.* Não`,
    success: (date, time, protocol) => `✅ *AGENDAMENTO CONFIRMADO!*\n\n📅 Data: ${date}\n⏰ Horário: ${time}\n🎫 Protocolo: ${protocol}\n\nVocê receberá uma confirmação 24h antes! 🔔`,
    cancelled: '❌ Agendamento cancelado.\n\nDigite *menu* para outras opções.'
  },

  // Mensagens de IA
  ai: {
    thinking: '🤔 Deixe-me pensar...',
    searching: '🔍 Buscando informações...',
    processing: '⚙️ Processando sua solicitação...'
  },

  // Mensagens de sistema
  system: {
    maintenance: '🔧 *MANUTENÇÃO*\n\nEstamos em manutenção programada.\n\nRetornaremos em breve!\n\nPara urgências: (XX) XXXXX-XXXX',
    offline: '📵 Sistema temporariamente indisponível.\n\nTente novamente em alguns minutos.',
    updated: '✨ Sistema atualizado!\n\nNovas funcionalidades disponíveis!'
  }
};

