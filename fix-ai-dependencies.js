const fs = require('fs');
const path = require('path');

console.log('🔧 Corrigindo dependências de AI...\n');

// 1. Adicionar variáveis ao .env
const envPath = path.join(__dirname, '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
  envContent = fs.readFileSync(envPath, 'utf8');
}

// Adicionar configurações se não existirem
if (!envContent.includes('ENABLE_AI')) {
  envContent += '\n# AI Configuration\n';
  envContent += 'ENABLE_AI=false\n';
  envContent += 'ENABLE_VOICE=false\n';
  envContent += 'OPENAI_API_KEY=sk-dummy-key-for-testing\n';
  
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Arquivo .env atualizado');
} else {
  console.log('⚠️ .env já contém configurações de AI');
}

// 2. Criar wrapper para aiEngine.js
const aiEnginePath = path.join(__dirname, 'src', 'bot', 'aiEngine.js');
if (fs.existsSync(aiEnginePath)) {
  let aiEngineContent = fs.readFileSync(aiEnginePath, 'utf8');
  
  if (!aiEngineContent.includes('ENABLE_AI')) {
    const mockCode = `// Auto-generated wrapper
if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-dummy-key-for-testing' || process.env.ENABLE_AI === 'false') {
  console.warn('⚠️ AI Engine desabilitado (configure OPENAI_API_KEY no .env)');
  module.exports = {
    classifyIntent: async () => ({ intent: 'unknown', confidence: 0 }),
    generateResponse: async () => 'O assistente AI não está disponível no momento.',
    extractEntities: async () => [],
    getSentiment: async () => ({ sentiment: 'neutral', score: 0 }),
  };
} else {
${aiEngineContent}
}
`;
    
    fs.writeFileSync(aiEnginePath, mockCode);
    console.log('✅ aiEngine.js protegido contra falta de API key');
  } else {
    console.log('⚠️ aiEngine.js já está protegido');
  }
}

// 3. Criar wrapper para voiceService.js
const voiceServicePath = path.join(__dirname, 'src', 'services', 'voiceService.js');
if (fs.existsSync(voiceServicePath)) {
  let voiceContent = fs.readFileSync(voiceServicePath, 'utf8');
  
  if (!voiceContent.includes('ENABLE_VOICE')) {
    const mockCode = `// Auto-generated wrapper
if (process.env.ENABLE_VOICE === 'false') {
  console.warn('⚠️ Voice Service desabilitado');
  module.exports = {
    transcribeAudio: async () => ({ text: '', confidence: 0 }),
    textToSpeech: async () => null,
  };
} else {
${voiceContent}
}
`;
    
    fs.writeFileSync(voiceServicePath, mockCode);
    console.log('✅ voiceService.js protegido');
  } else {
    console.log('⚠️ voiceService.js já está protegido');
  }
}

console.log('\n✅ Correção concluída!');
console.log('📝 Execute: npm start');

