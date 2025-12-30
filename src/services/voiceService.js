const logger = require('../utils/logger');

/**
 * Voice Service (Desabilitado temporariamente)
 * Será ativado quando Google Cloud for aprovado
 */
class VoiceService {
  constructor() {
    if (process.env.ENABLE_VOICE === 'false') {
      console.warn('⚠️ Voice Service desabilitado');
    } else {
      logger.info('ℹ️  Voice Service desabilitado (aguardando aprovação)');
    }
  }

  async transcribe(audioBase64, languageCode = 'pt-BR') {
    logger.warn('⚠️  Transcrição de áudio desabilitada');
    return null;
  }

  async synthesize(text, languageCode = 'pt-BR', voiceName = 'pt-BR-Standard-A') {
    logger.warn('⚠️  Síntese de voz desabilitada');
    return null;
  }

  async cleanTempFiles(olderThanHours = 24) {
    return 0;
  }
}

module.exports = VoiceService;
