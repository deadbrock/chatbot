/**
 * Script para criar atendentes do Departamento Pessoal
 */

require('dotenv').config();
const { sequelize } = require('../src/config/database');
const User = require('../src/models/UserSQL');

const dpAgents = [
  {
    name: 'Elaine',
    email: 'elaine@fgservices.com',
    password: 'FG@2024',
    role: 'agent',
    department: 'Departamento Pessoal',
    departmentId: 'dp',
    specialties: ['férias', 'auxílio transporte', 'vale transporte'],
    phone: null,
    active: true
  },
  {
    name: 'Adriana',
    email: 'adriana@fgservices.com',
    password: 'FG@2024',
    role: 'agent',
    department: 'Departamento Pessoal',
    departmentId: 'dp',
    specialties: ['admissão', 'contratação', 'novos colaboradores'],
    phone: null,
    active: true
  },
  {
    name: 'Joana',
    email: 'joana@fgservices.com',
    password: 'FG@2024',
    role: 'agent',
    department: 'Departamento Pessoal',
    departmentId: 'dp',
    specialties: ['admissão', 'contratação', 'novos colaboradores'],
    phone: null,
    active: true
  },
  {
    name: 'Draydiane',
    email: 'draydiane@fgservices.com',
    password: 'FG@2024',
    role: 'agent',
    department: 'Departamento Pessoal',
    departmentId: 'dp',
    specialties: ['admissão', 'contratação', 'novos colaboradores'],
    phone: null,
    active: true
  },
  {
    name: 'Alysson',
    email: 'alysson@fgservices.com',
    password: 'FG@2024',
    role: 'agent',
    department: 'Departamento Pessoal',
    departmentId: 'dp',
    specialties: ['processos', 'documentação', 'procedimentos'],
    phone: null,
    active: true
  },
  {
    name: 'Elias',
    email: 'elias@fgservices.com',
    password: 'FG@2024',
    role: 'manager',  // Coordenador = manager
    department: 'Departamento Pessoal',
    departmentId: 'dp',
    specialties: ['coordenação', 'assuntos gerenciais', 'escalação'],
    phone: null,
    active: true
  }
];

async function createDPAgents() {
  try {
    console.log('🚀 Conectando ao banco de dados...');
    await sequelize.authenticate();
    console.log('✅ Conectado!');

    console.log('\n👥 Criando atendentes do Departamento Pessoal...\n');

    for (const agentData of dpAgents) {
      try {
        // Verificar se já existe
        const existing = await User.findOne({ where: { email: agentData.email } });
        
        if (existing) {
          console.log(`⚠️  ${agentData.name} já existe (${agentData.email})`);
          // Atualizar specialties
          await sequelize.query(`
            UPDATE Users 
            SET stats = json_set(
              COALESCE(stats, '{}'), 
              '$.specialties', 
              json('${JSON.stringify(agentData.specialties)}')
            )
            WHERE email = ?
          `, {
            replacements: [agentData.email]
          });
          console.log(`   📋 Especialidades atualizadas: ${agentData.specialties.join(', ')}`);
        } else {
          // Criar novo usuário
          const { specialties, ...userData } = agentData;
          const user = await User.create(userData);
          
          // Adicionar specialties no stats
          await sequelize.query(`
            UPDATE Users 
            SET stats = json_set(
              COALESCE(stats, '{}'), 
              '$.specialties', 
              json('${JSON.stringify(specialties)}')
            )
            WHERE id = ?
          `, {
            replacements: [user.id]
          });
          
          console.log(`✅ ${agentData.name} criado(a)!`);
          console.log(`   📧 Email: ${agentData.email}`);
          console.log(`   🔑 Senha: ${agentData.password}`);
          console.log(`   📋 Especialidades: ${specialties.join(', ')}`);
          console.log(`   ${agentData.role === 'manager' ? '👔 Cargo: Coordenador' : '👤 Cargo: Atendente'}\n`);
        }
      } catch (error) {
        console.error(`❌ Erro ao criar ${agentData.name}:`, error.message);
      }
    }

    console.log('\n✅ Processo concluído!');
    console.log('\n📋 RESUMO DOS ATENDENTES CRIADOS:');
    console.log('==================================');
    console.log('Elaine       → Férias, Auxílio Transporte');
    console.log('Adriana      → Admissão');
    console.log('Joana        → Admissão');
    console.log('Draydiane    → Admissão');
    console.log('Alysson      → Processos');
    console.log('Elias        → Coordenador (Assuntos Gerenciais)');
    console.log('==================================');
    console.log('\n🔐 SENHA PADRÃO: FG@2024');
    console.log('⚠️  Recomende que os usuários alterem a senha no primeiro acesso!\n');

  } catch (error) {
    console.error('❌ Erro:', error);
  } finally {
    await sequelize.close();
  }
}

// Executar
createDPAgents();

