/**
 * Corrige atendentes com e-mail errado ou não encontrados pelo configure-dp-attendance.js
 */
require('dotenv').config();
const { sequelize } = require('../src/config/database');
const User = require('../src/models/UserSQL');
const { DP_TOPICS } = require('../src/config/dpAttendanceRouting');

function buildStats(topicId) {
  const topic = DP_TOPICS[topicId];
  return {
    specialties: topic ? [topic.label, ...topic.keywords.slice(0, 8)] : [],
    dpTopic: topicId,
    dpTopicLabel: topic?.label || topicId
  };
}

async function patchUser(id, patch) {
  const user = await User.findByPk(id);
  if (!user) {
    console.log(`❌ ID ${id} não encontrado`);
    return false;
  }
  Object.assign(user, patch);
  if (patch.stats) user.stats = { ...(user.stats || {}), ...patch.stats };
  await user.save();
  console.log(`✅ ${user.name} → ${user.email} | departmentId=${user.departmentId} | ${user.stats?.dpTopicLabel}`);
  return true;
}

async function main() {
  await sequelize.authenticate();

  // Leonildo → dp-12 (libera dp-11 para Thayna)
  await patchUser(15, {
    email: 'dp-12@fgservices.com.br',
    departmentId: 'dp',
    department: 'Departamento Pessoal',
    stats: buildStats('juridico_arquivo')
  });

  // Thayna → dp-11
  await patchUser(6, {
    email: 'dp-11@fgservices.com.br',
    departmentId: 'dp',
    department: 'Departamento Pessoal',
    stats: buildStats('folha_transferencias')
  });

  // Johnatan → dp-4 (e-mail estava dp-4@fgservices.combr)
  await patchUser(8, {
    email: 'dp-4@fgservices.com.br',
    departmentId: 'dp',
    department: 'Departamento Pessoal',
    stats: buildStats('juridico_arquivo')
  });

  await sequelize.close();
  console.log('\nConcluído. Rode: node scripts/check-agents-routing.js');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
