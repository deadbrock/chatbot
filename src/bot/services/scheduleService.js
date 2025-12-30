/**
 * Serviço de Verificação de Horário de Atendimento
 * Verifica se o contato está dentro do horário comercial
 */

const logger = require('../../utils/logger');

class ScheduleService {
  constructor() {
    // Horários configuráveis
    this.businessHours = {
      enabled: true,
      
      // Horários de atendimento
      schedule: {
        morning: {
          start: { hour: 8, minute: 0 },
          end: { hour: 12, minute: 0 }
        },
        afternoon: {
          start: { hour: 13, minute: 0 },
          end: { hour: 17, minute: 0 }
        }
      },
      
      // Dias da semana (0 = Domingo, 6 = Sábado)
      workDays: [1, 2, 3, 4, 5], // Segunda a Sexta
      
      // Feriados (formato: MM-DD)
      holidays: [
        '01-01', // Ano Novo
        '04-21', // Tiradentes
        '05-01', // Dia do Trabalho
        '09-07', // Independência
        '10-12', // Nossa Senhora Aparecida
        '11-02', // Finados
        '11-15', // Proclamação da República
        '12-25'  // Natal
      ]
    };
  }

  /**
   * Verifica se está dentro do horário de atendimento
   * @param {Date} date - Data para verificar (padrão: agora)
   * @returns {Object} { isOpen: boolean, reason: string, nextOpen: Date }
   */
  isBusinessHours(date = new Date()) {
    // Se verificação de horário estiver desabilitada
    if (!this.businessHours.enabled) {
      return {
        isOpen: true,
        reason: 'always_open',
        nextOpen: null
      };
    }

    try {
      // Verificar se é feriado
      const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      if (this.businessHours.holidays.includes(dateStr)) {
        return {
          isOpen: false,
          reason: 'holiday',
          message: 'Estamos em feriado. Retornaremos no próximo dia útil.',
          nextOpen: this.getNextBusinessDay(date)
        };
      }

      // Verificar dia da semana
      const dayOfWeek = date.getDay();
      if (!this.businessHours.workDays.includes(dayOfWeek)) {
        return {
          isOpen: false,
          reason: 'weekend',
          message: 'Nosso atendimento é de Segunda a Sexta-feira, das 8h às 12h e das 13h às 17h.',
          nextOpen: this.getNextBusinessDay(date)
        };
      }

      // Verificar horário
      const currentMinutes = date.getHours() * 60 + date.getMinutes();
      
      const morningStart = this.businessHours.schedule.morning.start.hour * 60 + 
                          this.businessHours.schedule.morning.start.minute;
      const morningEnd = this.businessHours.schedule.morning.end.hour * 60 + 
                        this.businessHours.schedule.morning.end.minute;
      
      const afternoonStart = this.businessHours.schedule.afternoon.start.hour * 60 + 
                            this.businessHours.schedule.afternoon.start.minute;
      const afternoonEnd = this.businessHours.schedule.afternoon.end.hour * 60 + 
                          this.businessHours.schedule.afternoon.end.minute;

      // Está no horário da manhã?
      if (currentMinutes >= morningStart && currentMinutes < morningEnd) {
        return {
          isOpen: true,
          reason: 'business_hours',
          period: 'morning',
          message: null
        };
      }

      // Está no horário da tarde?
      if (currentMinutes >= afternoonStart && currentMinutes < afternoonEnd) {
        return {
          isOpen: true,
          reason: 'business_hours',
          period: 'afternoon',
          message: null
        };
      }

      // Fora do horário
      let nextOpen;
      let message;

      if (currentMinutes < morningStart) {
        // Antes das 8h
        nextOpen = new Date(date);
        nextOpen.setHours(this.businessHours.schedule.morning.start.hour);
        nextOpen.setMinutes(this.businessHours.schedule.morning.start.minute);
        message = 'Nosso atendimento inicia às 8h. Aguardamos você!';
      } else if (currentMinutes >= morningEnd && currentMinutes < afternoonStart) {
        // Horário de almoço
        nextOpen = new Date(date);
        nextOpen.setHours(this.businessHours.schedule.afternoon.start.hour);
        nextOpen.setMinutes(this.businessHours.schedule.afternoon.start.minute);
        message = 'Estamos em horário de almoço (12h-13h). Retornamos às 13h!';
      } else {
        // Depois das 17h
        nextOpen = this.getNextBusinessDay(date);
        nextOpen.setHours(this.businessHours.schedule.morning.start.hour);
        nextOpen.setMinutes(this.businessHours.schedule.morning.start.minute);
        message = 'Nosso atendimento encerrou às 17h. Retornaremos amanhã às 8h!';
      }

      return {
        isOpen: false,
        reason: 'outside_hours',
        message,
        nextOpen
      };

    } catch (error) {
      logger.error('Erro ao verificar horário de atendimento:', error);
      // Em caso de erro, considera como aberto
      return {
        isOpen: true,
        reason: 'error',
        message: null
      };
    }
  }

  /**
   * Obtém o próximo dia útil
   * @param {Date} date - Data atual
   * @returns {Date} Próximo dia útil
   */
  getNextBusinessDay(date) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);

    // Procurar próximo dia útil
    let attempts = 0;
    while (attempts < 10) {
      const dayOfWeek = nextDay.getDay();
      const dateStr = `${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
      
      // Verificar se é dia útil e não é feriado
      if (this.businessHours.workDays.includes(dayOfWeek) && 
          !this.businessHours.holidays.includes(dateStr)) {
        return nextDay;
      }
      
      nextDay.setDate(nextDay.getDate() + 1);
      attempts++;
    }

    return nextDay;
  }

  /**
   * Formata a data do próximo atendimento
   * @param {Date} date - Data
   * @returns {string} Texto formatado
   */
  formatNextOpen(date) {
    if (!date) return '';

    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 
                  'Quinta-feira', 'Sexta-feira', 'Sábado'];
    
    const dayName = days[date.getDay()];
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${dayName} às ${hours}:${minutes}`;
  }

  /**
   * Configura novos horários de atendimento
   * @param {Object} config - Nova configuração
   */
  setBusinessHours(config) {
    this.businessHours = { ...this.businessHours, ...config };
    logger.info('Horários de atendimento atualizados:', this.businessHours);
  }
}

module.exports = new ScheduleService();

