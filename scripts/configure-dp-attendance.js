/**
 * Configura especialidades e departamento dos atendentes do DP — FG Services
 * Atualiza usuários já cadastrados (não cria senhas novas).
 *
 * Uso: node scripts/configure-dp-attendance.js
 */

require('dotenv').config();
const { sequelize } = require('../src/config/database');
const User = require('../src/models/UserSQL');
const { Op } = require('sequelize');
const { DP_TOPICS } = require('../src/config/dpAttendanceRouting');

const AGENT_CONFIG = [
  { name: 'Elaine', emails: ['dp-3@fgservices.com.br', 'elaine@fgservices.com'], topic: 'beneficios' },
  { name: 'Johnatan', emails: ['dp-4@fgservices.com.br'], topic: 'juridico_arquivo', matchNames: ['johnatan', 'jonathan'] },
  { name: 'Taiza', emails: ['dp-5@fgservices.com.br'], topic: 'rescisoes', matchNames: ['taiza'] },
  { name: 'Joanna', emails: ['dp-6@fgservices.com.br', 'joana@fgservices.com'], topic: 'beneficios', matchNames: ['joanna', 'joana'] },
  { name: 'Adriana', emails: ['dp-7@fgservices.com.br', 'adriana@fgservices.com'], topic: 'folha_transferencias' },
  { name: 'Diane', emails: ['dp-8@fgservices.com.br'], topic: 'admissao', matchNames: ['diane', 'draydiane'] },
  { name: 'Allysson', emails: ['dp-9@fgservices.com.br', 'alysson@fgservices.com'], topic: 'outros_afastamentos' },
  { name: 'Evair', emails: ['dp-10@fgservices.com.br'], topic: 'admissao', matchNames: ['evair'] },
  { name: 'Thayna', emails: ['dp-11@fgservices.com.br'], topic: 'folha_transferencias', matchNames: ['thayna'] },
  { name: 'Leonildo', emails: ['dp-12@fgservices.com.br'], topic: 'juridico_arquivo', matchNames: ['leonildo'] },
  { name: 'Adna', emails: ['gestaodp@fgservices.com.br'], topic: 'gestao_dp', role: 'manager', matchNames: ['adna'] }
];

function buildSpecialties(topicId) {
  const topic = DP_TOPICS[topicId];
  if (!topic) return [];
  return [topic.label, ...topic.keywords.slice(0, 8)];
}

async function findAgent(config) {
  const emailList = config.emails || (config.email ? [config.email] : []);

  for (const email of emailList) {
    const byEmail = await User.findOne({ where: { email } });
    if (byEmail) return byEmail;
  }

  const nameFragments = [
    ...(config.matchNames || []),
    config.name?.toLowerCase()
  ].filter(Boolean);

  for (const fragment of nameFragments) {
    const byName = await User.findOne({
      where: {
        name: { [Op.iLike]: `%${fragment}%` }
      }
    });
    if (byName) return byName;
  }

  return null;
}

async function configureDPAttendance() {
  try {
    console.log('🚀 Conectando ao banco...');
    await sequelize.authenticate();
    console.log('✅ Conectado!\n');
    console.log('👥 Configurando atendentes do Departamento Pessoal...\n');

    let updated = 0;
    let missing = 0;

    for (const config of AGENT_CONFIG) {
      const user = await findAgent(config);

      if (!user) {
        console.log(`❌ Não encontrado: ${config.name} (${(config.emails || []).join(' / ') || 'busca por nome'})`);
        missing += 1;
        continue;
      }

      const topic = DP_TOPICS[config.topic];
      const specialties = buildSpecialties(config.topic);
      const preferredEmail = (config.emails || [])[0];
      const stats = {
        ...(user.stats || {}),
        specialties,
        dpTopic: config.topic,
        dpTopicLabel: topic?.label || config.topic
      };

      user.department = 'Departamento Pessoal';
      user.departmentId = 'dp';
      user.active = true;
      if (preferredEmail && user.email !== preferredEmail) {
        const emailTaken = await User.findOne({ where: { email: preferredEmail } });
        if (!emailTaken) {
          user.email = preferredEmail;
        }
      }
      if (config.role) {
        user.role = config.role;
      }
      user.stats = stats;
      await user.save();

      console.log(`✅ ${user.name} (${user.email})`);
      console.log(`   📋 Tema: ${topic?.label || config.topic}`);
      console.log(`   🏷️  Especialidades: ${specialties.slice(0, 4).join(', ')}...\n`);
      updated += 1;
    }

    console.log('══════════════════════════════════════');
    console.log(`✅ Atualizados: ${updated}`);
    if (missing) {
      console.log(`⚠️  Não encontrados: ${missing}`);
      console.log('   Verifique os e-mails no painel Administração → Atendentes');
    }
    console.log('══════════════════════════════════════\n');
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

configureDPAttendance();
