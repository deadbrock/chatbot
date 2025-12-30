/**
 * Script para popular banco com fluxos e templates de exemplo
 */

const { sequelize } = require('../config/database');
const Flow = require('../models/FlowSQL');
const MessageTemplate = require('../models/MessageTemplateSQL');
const logger = require('../utils/logger');

async function seedFlows() {
  try {
    logger.info('🌱 Populando fluxos de exemplo...');

    // Fluxo 1: Rastreamento de Pedido
    const trackingFlow = await Flow.create({
      name: 'Rastreamento de Pedido',
      description: 'Fluxo para rastrear pedidos do cliente',
      trigger: 'rastrear',
      triggerType: 'keyword',
      department: 'Logística',
      priority: 10,
      status: 'active',
      variables: {
        orderNumber: '',
        trackingCode: ''
      },
      steps: [
        {
          id: 'step1',
          type: 'message',
          content: '📦 *RASTREAMENTO DE PEDIDO*\n\nVou te ajudar a rastrear seu pedido!',
          next: 'step2'
        },
        {
          id: 'step2',
          type: 'collect',
          prompt: 'Por favor, informe o número do seu pedido:',
          saveAs: 'orderNumber',
          dataType: 'text',
          next: 'step3'
        },
        {
          id: 'step3',
          type: 'message',
          content: '🔍 Buscando informações do pedido {{orderNumber}}...\n\n⏳ Aguarde um momento...',
          delay: 2000,
          next: 'step4'
        },
        {
          id: 'step4',
          type: 'message',
          content: '✅ *PEDIDO ENCONTRADO*\n\n📦 Pedido: {{orderNumber}}\n📍 Status: Em trânsito\n🚚 Previsão: 2-3 dias úteis\n\nDeseja mais alguma coisa?\n\n*1.* Sim\n*2.* Não',
          next: 'auto'
        }
      ]
    });

    // Fluxo 2: Solicitação de Orçamento
    const quoteFlow = await Flow.create({
      name: 'Solicitação de Orçamento',
      description: 'Fluxo para solicitar orçamentos',
      trigger: 'orçamento',
      triggerType: 'keyword',
      department: 'Comercial',
      priority: 8,
      status: 'active',
      variables: {
        productName: '',
        quantity: '',
        email: ''
      },
      steps: [
        {
          id: 'step1',
          type: 'message',
          content: '💼 *SOLICITAÇÃO DE ORÇAMENTO*\n\nVou te ajudar a solicitar um orçamento!',
          next: 'step2'
        },
        {
          id: 'step2',
          type: 'question',
          question: 'Qual produto você deseja orçar?',
          saveAs: 'productName',
          next: 'step3'
        },
        {
          id: 'step3',
          type: 'collect',
          prompt: 'Qual a quantidade desejada?',
          saveAs: 'quantity',
          dataType: 'number',
          validation: {
            type: 'number',
            min: 1,
            errorMessage: '❌ Por favor, informe uma quantidade válida (mínimo 1).'
          },
          next: 'step4'
        },
        {
          id: 'step4',
          type: 'collect',
          prompt: 'Por favor, informe seu e-mail para enviarmos o orçamento:',
          saveAs: 'email',
          dataType: 'email',
          validation: {
            type: 'email',
            errorMessage: '❌ E-mail inválido. Por favor, informe um e-mail válido.'
          },
          next: 'step5'
        },
        {
          id: 'step5',
          type: 'message',
          content: '✅ *ORÇAMENTO SOLICITADO*\n\n📦 Produto: {{productName}}\n📊 Quantidade: {{quantity}}\n📧 E-mail: {{email}}\n\nNosso time comercial entrará em contato em até 24h!\n\nObrigado! 😊',
          next: 'auto'
        }
      ]
    });

    // Fluxo 3: Suporte Técnico
    const supportFlow = await Flow.create({
      name: 'Suporte Técnico',
      description: 'Fluxo para abertura de chamado técnico',
      trigger: 'suporte',
      triggerType: 'keyword',
      department: 'TI',
      priority: 9,
      status: 'active',
      variables: {
        problemType: '',
        description: ''
      },
      steps: [
        {
          id: 'step1',
          type: 'message',
          content: '💻 *SUPORTE TÉCNICO*\n\nVou te ajudar a abrir um chamado!',
          next: 'step2'
        },
        {
          id: 'step2',
          type: 'options',
          message: 'Qual o tipo de problema?',
          options: [
            { label: 'Senha/Acesso', value: 'password', next: 'step3' },
            { label: 'Sistema/Software', value: 'system', next: 'step3' },
            { label: 'Internet/Rede', value: 'network', next: 'step3' },
            { label: 'Hardware', value: 'hardware', next: 'step3' },
            { label: 'Outro', value: 'other', next: 'step3' }
          ],
          next: 'conditional'
        },
        {
          id: 'step3',
          type: 'collect',
          prompt: 'Descreva o problema em detalhes:',
          saveAs: 'description',
          dataType: 'text',
          next: 'step4'
        },
        {
          id: 'step4',
          type: 'action',
          action: 'create_ticket',
          next: 'step5'
        },
        {
          id: 'step5',
          type: 'message',
          content: '✅ *CHAMADO ABERTO*\n\n🎫 Protocolo: #TKT-{{timestamp}}\n📝 Tipo: {{problemType}}\n\nNossa equipe de TI foi notificada e entrará em contato em breve!\n\nObrigado! 💙',
          next: 'auto'
        }
      ]
    });

    logger.info(`✅ ${3} fluxos criados com sucesso!`);

  } catch (error) {
    logger.error('❌ Erro ao popular fluxos:', error);
  }
}

async function seedTemplates() {
  try {
    logger.info('🌱 Populando templates de exemplo...');

    const templates = [
      {
        name: 'Boas-vindas',
        category: 'greeting',
        content: '🤖 Olá, {{userName}}!\n\nBem-vindo(a) ao nosso atendimento!\n\nComo posso ajudar você hoje?',
        variables: [
          { name: 'userName', description: 'Nome do usuário', default: 'Cliente' }
        ],
        status: 'active'
      },
      {
        name: 'Despedida',
        category: 'closing',
        content: '👋 Até logo, {{userName}}!\n\nFoi um prazer ajudar você!\n\nVolte sempre! 💙',
        variables: [
          { name: 'userName', description: 'Nome do usuário', default: 'Cliente' }
        ],
        status: 'active'
      },
      {
        name: 'Confirmação de Agendamento',
        category: 'confirmation',
        content: '✅ *AGENDAMENTO CONFIRMADO*\n\n📅 Data: {{date}}\n⏰ Horário: {{time}}\n📍 Local: {{location}}\n\nVocê receberá um lembrete 24h antes! 🔔',
        variables: [
          { name: 'date', description: 'Data do agendamento' },
          { name: 'time', description: 'Horário do agendamento' },
          { name: 'location', description: 'Local do agendamento' }
        ],
        status: 'active'
      },
      {
        name: 'Erro Genérico',
        category: 'error',
        content: '❌ Desculpe, ocorreu um erro.\n\n{{errorMessage}}\n\nPor favor, tente novamente ou digite *menu*.',
        variables: [
          { name: 'errorMessage', description: 'Mensagem de erro', default: 'Erro desconhecido' }
        ],
        status: 'active'
      },
      {
        name: 'Protocolo Criado',
        category: 'info',
        content: '✅ *PROTOCOLO CRIADO*\n\n🎫 Número: {{protocol}}\n📅 Data: {{date}}\n📋 Departamento: {{department}}\n\nGuarde este número para acompanhar seu atendimento!',
        variables: [
          { name: 'protocol', description: 'Número do protocolo' },
          { name: 'date', description: 'Data de criação' },
          { name: 'department', description: 'Departamento responsável' }
        ],
        status: 'active'
      }
    ];

    for (const template of templates) {
      await MessageTemplate.create(template);
    }

    logger.info(`✅ ${templates.length} templates criados com sucesso!`);

  } catch (error) {
    logger.error('❌ Erro ao popular templates:', error);
  }
}

async function seed() {
  try {
    await sequelize.authenticate();
    logger.info('✅ Conectado ao banco de dados');

    await seedFlows();
    await seedTemplates();

    logger.info('🎉 Seed concluído com sucesso!');
    process.exit(0);

  } catch (error) {
    logger.error('❌ Erro no seed:', error);
    process.exit(1);
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  seed();
}

module.exports = { seedFlows, seedTemplates };

