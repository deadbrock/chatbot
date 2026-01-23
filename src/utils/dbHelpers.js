const { sequelize } = require('../config/database');
const { literal } = require('sequelize');

/**
 * Database Helper Functions
 * Fornece funções SQL compatíveis com SQLite e PostgreSQL
 */

/**
 * Retorna o dialect do banco de dados
 */
function getDialect() {
  return sequelize.getDialect();
}

/**
 * Formatar data como string (YYYY-MM-DD)
 * @param {string} column - Nome da coluna
 * @returns {Sequelize.literal}
 */
function formatDateStr(column) {
  const dialect = getDialect();
  
  if (dialect === 'postgres') {
    return literal(`TO_CHAR("${column}", 'YYYY-MM-DD')`);
  }
  
  // SQLite
  return literal(`strftime('%Y-%m-%d', ${column})`);
}

/**
 * Diferença entre duas datas em segundos
 * @param {string} endColumn - Coluna de data final
 * @param {string} startColumn - Coluna de data inicial  
 * @returns {Sequelize.literal}
 */
function dateDiffSeconds(endColumn, startColumn) {
  const dialect = getDialect();
  
  if (dialect === 'postgres') {
    return literal(`EXTRACT(EPOCH FROM ("${endColumn}" - "${startColumn}"))`);
  }
  
  // SQLite
  return literal(`(strftime('%s', ${endColumn}) - strftime('%s', ${startColumn}))`);
}

/**
 * Diferença entre duas datas em minutos
 * @param {string} endColumn - Coluna de data final
 * @param {string} startColumn - Coluna de data inicial
 * @returns {Sequelize.literal}
 */
function dateDiffMinutes(endColumn, startColumn) {
  const dialect = getDialect();
  
  if (dialect === 'postgres') {
    return literal(`EXTRACT(EPOCH FROM ("${endColumn}" - "${startColumn}")) / 60`);
  }
  
  // SQLite
  return literal(`(julianday(${endColumn}) - julianday(${startColumn})) * 1440`);
}

/**
 * Diferença entre duas datas em milissegundos
 * @param {string} endColumn - Coluna de data final
 * @param {string} startColumn - Coluna de data inicial
 * @returns {Sequelize.literal}
 */
function dateDiffMillis(endColumn, startColumn) {
  const dialect = getDialect();
  
  if (dialect === 'postgres') {
    return literal(`EXTRACT(EPOCH FROM ("${endColumn}" - "${startColumn}")) * 1000`);
  }
  
  // SQLite
  return literal(`(strftime('%s', ${endColumn}) - strftime('%s', ${startColumn})) * 1000`);
}

/**
 * Quote identifier (tabela ou coluna)
 * @param {string} identifier - Nome da tabela ou coluna
 * @returns {string}
 */
function quoteIdentifier(identifier) {
  const dialect = getDialect();
  
  if (dialect === 'postgres') {
    return `"${identifier}"`;
  }
  
  // SQLite usa aspas simples ou nenhuma
  return identifier;
}

/**
 * Gera SQL para diferença de datas em minutos (para queries raw)
 * @param {string} endColumn - Nome da coluna de data final
 * @param {string} startColumn - Nome da coluna de data inicial
 * @returns {string}
 */
function rawDateDiffMinutesSQL(endColumn, startColumn) {
  const dialect = getDialect();
  
  if (dialect === 'postgres') {
    // IMPORTANTE: Quotar os nomes das colunas para case-sensitivity
    return `EXTRACT(EPOCH FROM ("${endColumn}" - "${startColumn}")) / 60`;
  }
  
  // SQLite
  return `(julianday(${endColumn}) - julianday(${startColumn})) * 24 * 60`;
}

/**
 * Gera SQL para formatação de data (para queries raw)
 * @param {string} column - Nome da coluna
 * @param {string} format - Formato SQLite style (ex: '%Y-%m-%d', '%H', '%Y-%m')
 * @returns {string}
 */
function rawFormatDateSQL(column, format = '%Y-%m-%d') {
  const dialect = getDialect();
  
  if (dialect === 'postgres') {
    // Converter formato SQLite para PostgreSQL
    const pgFormat = format
      .replace(/%Y/g, 'YYYY')
      .replace(/%m/g, 'MM')
      .replace(/%d/g, 'DD')
      .replace(/%H/g, 'HH24')
      .replace(/%M/g, 'MI')
      .replace(/%S/g, 'SS');
    // IMPORTANTE: Quotar o nome da coluna para case-sensitivity
    return `TO_CHAR("${column}", '${pgFormat}')`;
  }
  
  // SQLite
  return `strftime('${format}', ${column})`;
}

/**
 * Gera SQL para extrair hora de uma data (0-23)
 * @param {string} column - Nome da coluna
 * @returns {string}
 */
function rawExtractHourSQL(column) {
  const dialect = getDialect();
  
  if (dialect === 'postgres') {
    // IMPORTANTE: Quotar o nome da coluna para case-sensitivity
    return `EXTRACT(HOUR FROM "${column}")`;
  }
  
  // SQLite
  return `CAST(strftime('%H', ${column}) AS INTEGER)`;
}

module.exports = {
  getDialect,
  formatDateStr,
  dateDiffSeconds,
  dateDiffMinutes,
  dateDiffMillis,
  quoteIdentifier,
  rawDateDiffMinutesSQL,
  rawFormatDateSQL,
  rawExtractHourSQL
};
