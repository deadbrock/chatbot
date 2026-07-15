/**
 * Serviço de Roteamento Inteligente de Tickets
 * Distribui tickets automaticamente para o atendente mais adequado
 */

const logger = require('../utils/logger');
const User = require('../models/UserSQL');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  DP_TOPICS,
  JURIDICO_EXTRA_AGENT_NAMES,
  resolveDPTopic,
  getAgentEmailsForTopic
} = require('../config/dpAttendanceRouting');

class TicketRoutingService {
  /**
   * Roteia um ticket para o atendente mais adequado
   * @param {Object} ticketData - Dados do ticket (department, subject, description)
   * @returns {Object} - { agentId, agentName, reason }
   */
  async routeTicket(ticketData) {
    try {
      const { department, departmentId, subject, description, userMessage } = ticketData;

      logger.info(`🎯 Roteando ticket: Dept=${departmentId}, Assunto="${subject}"`);

      const agents = await User.findAll({
        where: {
          departmentId: departmentId || department,
          active: true,
          role: {
            [Op.in]: ['agent', 'manager']
          }
        },
        attributes: ['id', 'name', 'email', 'role', 'stats']
      });

      if (agents.length === 0) {
        logger.warn(`⚠️ Nenhum atendente encontrado para o departamento: ${departmentId}`);
        return null;
      }

      logger.info(`👥 Encontrados ${agents.length} atendentes no departamento`);

      const fullText = `${subject} ${description} ${userMessage || ''}`.toLowerCase();

      let bestMatch = null;
      let highestScore = 0;

      for (const agent of agents) {
        const stats = agent.stats || {};
        const specialties = stats.specialties || [];

        if (specialties.length === 0) {
          continue;
        }

        let score = 0;
        const matchedSpecialties = [];

        for (const specialty of specialties) {
          if (fullText.includes(specialty.toLowerCase())) {
            score += 10;
            matchedSpecialties.push(specialty);
          }
        }

        if (agent.role === 'manager') {
          const complexKeywords = ['urgente', 'coordenador', 'gerência', 'escalação', 'problema', 'reclamação'];
          if (complexKeywords.some((kw) => fullText.includes(kw))) {
            score += 5;
            matchedSpecialties.push('coordenação');
          }
        }

        logger.info(`   ${agent.name}: Score=${score}, Especialidades=${specialties.join(', ')}`);

        if (score > highestScore) {
          highestScore = score;
          bestMatch = {
            agentId: agent.id,
            agentName: agent.name,
            agentEmail: agent.email,
            role: agent.role,
            matchedSpecialties,
            score,
            topicLabel: stats.dpTopicLabel || null
          };
        }
      }

      if (!bestMatch) {
        const randomAgent = agents[Math.floor(Math.random() * agents.length)];
        bestMatch = {
          agentId: randomAgent.id,
          agentName: randomAgent.name,
          agentEmail: randomAgent.email,
          role: randomAgent.role,
          matchedSpecialties: [],
          score: 0,
          reason: 'Distribuição aleatória (nenhuma especialidade correspondente)'
        };
        logger.info(`🎲 Distribuição aleatória para: ${randomAgent.name}`);
      } else {
        bestMatch.reason = `Especialidade: ${bestMatch.matchedSpecialties.join(', ')}`;
        logger.info(`✅ Melhor match: ${bestMatch.agentName} (Score: ${bestMatch.score})`);
      }

      return bestMatch;
    } catch (error) {
      logger.error('❌ Erro ao rotear ticket:', error);
      return null;
    }
  }

  /**
   * Roteia especificamente para atendentes do DP por tema/assunto
   */
  async routeDPTicket(ticketData = {}) {
    const topicConfig = resolveDPTopic(ticketData);
    const fullText = [
      ticketData.topic,
      ticketData.subject,
      ticketData.description,
      ticketData.userMessage,
      ticketData.department
    ].filter(Boolean).join(' ');

    logger.info(`🎯 Roteamento DP — tema: ${topicConfig.label}`);

    const escalationKeywords = DP_TOPICS.gestao_dp.keywords;
    const normalized = fullText.toLowerCase();
    const needsManager = escalationKeywords.some((kw) => normalized.includes(kw.toLowerCase()));

    if (needsManager) {
      const manager = await this.findAgentByEmails(getAgentEmailsForTopic(DP_TOPICS.gestao_dp));
      if (manager) {
        return this.buildRoutingResult(manager, topicConfig, 'Gestão do DP (escalação)');
      }
    }

    let candidateEmails = getAgentEmailsForTopic(topicConfig);

    if (topicConfig.id === 'juridico_arquivo') {
      const extraAgents = await User.findAll({
        where: {
          active: true,
          departmentId: 'dp',
          [Op.or]: JURIDICO_EXTRA_AGENT_NAMES.map((name) => ({
            name: { [Op.like]: `%${name}%` }
          }))
        },
        attributes: ['id', 'name', 'email', 'role', 'stats']
      });
      for (const agent of extraAgents) {
        if (agent.email && !candidateEmails.includes(agent.email)) {
          candidateEmails.push(agent.email);
        }
      }
    }

    let agents = await User.findAll({
      where: {
        active: true,
        departmentId: 'dp',
        role: { [Op.in]: ['agent', 'manager'] },
        [Op.or]: [
          { email: { [Op.in]: candidateEmails } },
          sequelize.where(
            sequelize.fn('json_extract', sequelize.col('stats'), '$.dpTopic'),
            topicConfig.id
          )
        ]
      },
      attributes: ['id', 'name', 'email', 'role', 'stats']
    });

    if (agents.length === 0) {
      agents = await User.findAll({
        where: {
          email: { [Op.in]: candidateEmails },
          active: true,
          role: { [Op.in]: ['agent', 'manager'] }
        },
        attributes: ['id', 'name', 'email', 'role', 'stats']
      });
    }

    if (agents.length === 0) {
      logger.warn(`⚠️ Nenhum atendente ativo para o tema ${topicConfig.label} — fallback genérico DP`);
      return this.routeTicket({
        ...ticketData,
        departmentId: 'dp',
        department: 'Departamento Pessoal'
      });
    }

    const ranked = agents
      .map((agent) => {
        const stats = agent.stats || {};
        const specialties = stats.specialties || topicConfig.keywords;
        let score = 0;
        const matched = [];

        for (const specialty of specialties) {
          if (normalized.includes(String(specialty).toLowerCase())) {
            score += 10;
            matched.push(specialty);
          }
        }

        const workload = Number(stats.ticketsHandled) || 0;

        return { agent, score, matched, workload };
      })
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.workload - b.workload;
      });

    const selected = ranked[0].agent;
    const reason = ranked[0].matched.length
      ? `Tema ${topicConfig.label}: ${ranked[0].matched.join(', ')}`
      : `Tema ${topicConfig.label} — distribuição por carga`;

    return this.buildRoutingResult(selected, topicConfig, reason);
  }

  async findAgentByEmails(emails = []) {
    if (!emails.length) return null;
    return User.findOne({
      where: {
        email: { [Op.in]: emails },
        active: true
      },
      attributes: ['id', 'name', 'email', 'role', 'stats']
    });
  }

  buildRoutingResult(agent, topicConfig, reason) {
    logger.info(`✅ Roteamento DP: ${agent.name} — ${reason}`);
    return {
      agentId: agent.id,
      agentName: agent.name,
      agentEmail: agent.email,
      role: agent.role,
      topicId: topicConfig.id,
      topicLabel: topicConfig.label,
      matchedSpecialties: [],
      score: 0,
      reason
    };
  }
}

module.exports = new TicketRoutingService();
