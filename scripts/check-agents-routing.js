/**
 * Verifica se atendentes (Users) estão prontos para roteamento
 * Uso: node scripts/check-agents-routing.js
 */
require('dotenv').config();
const { sequelize } = require('../src/config/database');
const User = require('../src/models/UserSQL');
const { Op } = require('sequelize');

async function main() {
  await sequelize.authenticate();
  console.log('👥 Atendentes na tabela Users (role agent/manager):\n');

  const agents = await User.findAll({
    where: { role: { [Op.in]: ['agent', 'manager'] }, active: true },
    attributes: ['id', 'name', 'email', 'role', 'department', 'departmentId', 'status', 'stats'],
    order: [['id', 'ASC']]
  });

  if (!agents.length) {
    console.log('❌ Nenhum atendente encontrado!');
    console.log('   Cadastre em: Painel → Atendentes, ou rode node scripts/seed-dp-agents.js');
    process.exit(1);
  }

  const rows = agents.map((a) => {
    const stats = a.stats || {};
    const okDept = a.departmentId === 'dp';
    const okEmail = /@fgservices\.com/i.test(a.email);
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      role: a.role,
      departmentId: a.departmentId || '(vazio)',
      department: a.department || '',
      status: a.status,
      dpTopic: stats.dpTopic || '(não configurado)',
      pronto: okDept && okEmail ? '✅' : '⚠️'
    };
  });

  console.table(rows);

  const semDeptId = agents.filter((a) => !a.departmentId);
  const emailsRuins = agents.filter((a) => a.email.includes('combr') || a.email.includes('@admin.com'));

  console.log('\n📋 Resumo:');
  console.log(`   Total atendentes: ${agents.length}`);
  console.log(`   Sem departmentId "dp": ${semDeptId.length}`);
  console.log(`   E-mails suspeitos: ${emailsRuins.length}`);

  if (semDeptId.length) {
    console.log('\n⚠️  Rode para corrigir roteamento DP:');
    console.log('   node scripts/configure-dp-attendance.js');
  }

  await sequelize.close();
}

main().catch((err) => {
  console.error('❌', err.message);
  process.exit(1);
});
