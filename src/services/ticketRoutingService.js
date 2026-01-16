/**
 * Serviço de Roteamento Inteligente de Tickets
 * Distribui tickets automaticamente para o atendente mais adequado
 */

const logger = require('../utils/logger');
const User = require('../models/UserSQL');
const { Op } = require('sequelize');

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

      // Buscar atendentes do departamento
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

      // Analisar qual atendente é mais adequado
      const fullText = `${subject} ${description} ${userMessage || ''}`.toLowerCase();
      
      let bestMatch = null;
      let highestScore = 0;

      for (const agent of agents) {
        const stats = agent.stats || {};
        const specialties = stats.specialties || [];

        if (specialties.length === 0) {
          continue; // Pular atendentes sem especialidades
        }

        let score = 0;
        const matchedSpecialties = [];

        // Verificar quantas especialidades correspondem ao assunto
        for (const specialty of specialties) {
          if (fullText.includes(specialty.toLowerCase())) {
            score += 10;
            matchedSpecialties.push(specialty);
          }
        }

        // Bonus para coordenadores em assuntos complexos
        if (agent.role === 'manager') {
          const complexKeywords = ['urgente', 'coordenador', 'gerência', 'escalação', 'problema', 'reclamação'];
          if (complexKeywords.some(kw => fullText.includes(kw))) {
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
            score
          };
        }
      }

      // Se nenhum match específico, distribuir por round-robin ou pegar o primeiro disponível
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
   * Roteia especificamente para atendentes de DP
   */
  async routeDPTicket(ticketData) {
    const { subject, description, userMessage } = ticketData;
    const fullText = `${subject} ${description} ${userMessage || ''}`.toLowerCase();

    logger.info(`🎯 Roteamento específico de DP: "${subject}"`);

    // Regras específicas do DP
    const dpRules = {
      'elaine': ['férias', 'auxílio transporte', 'vale transporte', 'vale-transporte'],
      'adriana': ['admissão', 'admitir', 'contratar', 'novo colaborador', 'contratação'],
      'joana': ['admissão', 'admitir', 'contratar', 'novo colaborador', 'contratação'],
      'draydiane': ['admissão', 'admitir', 'contratar', 'novo colaborador', 'contratação'],
      'alysson': ['processo', 'documentação', 'documento', 'procedimento', 'tramite'],
      'elias': ['coordenador', 'coordenação', 'gerencial', 'escalação', 'urgente', 'complexo']
    };

    let bestAgent = null;
    let highestScore = 0;

    for (const [agentEmail, keywords] of Object.entries(dpRules)) {
      let score = 0;
      const matchedKeywords = [];

      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          score += 10;
          matchedKeywords.push(keyword);
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestAgent = {
          email: `${agentEmail}@fgservices.com`,
          keywords: matchedKeywords,
          score
        };
      }
    }

    if (bestAgent) {
      const agent = await User.findOne({ where: { email: bestAgent.email } });
      if (agent) {
        logger.info(`✅ Roteamento DP: ${agent.name} (Score: ${bestAgent.score})`);
        return {
          agentId: agent.id,
          agentName: agent.name,
          agentEmail: agent.email,
          role: agent.role,
          matchedSpecialties: bestAgent.keywords,
          score: bestAgent.score,
          reason: `Especialidade DP: ${bestAgent.keywords.join(', ')}`
        };
      }
    }

    // Fallback: usar roteamento genérico
    return await this.routeTicket({
      ...ticketData,
      departmentId: 'dp',
      department: 'Departamento Pessoal'
    });
  }
}

module.exports = new TicketRoutingService();

