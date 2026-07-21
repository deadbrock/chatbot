const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');

const AVATAR_DIR = path.join(__dirname, '../../uploads/avatars');

function serializeUser(user) {
  if (!user) return null;
  const json = user.toJSON ? user.toJSON() : user;
  const { password, ...safeUser } = json;
  return safeUser;
}

async function ensureUserProfileSchema() {
  const qi = sequelize.getQueryInterface();
  const tableNames = ['Users', 'users'];

  for (const tableName of tableNames) {
    try {
      const table = await qi.describeTable(tableName);
      if (!table) continue;

      if (!table.avatar) {
        await qi.addColumn(tableName, 'avatar', {
          type: DataTypes.STRING,
          allowNull: true
        });
        logger.info(`✅ Coluna ${tableName}.avatar adicionada`);
      }
      return;
    } catch (error) {
      if (tableName === tableNames[tableNames.length - 1]) {
        logger.warn(`ensureUserProfileSchema: ${error.message}`);
      }
    }
  }
}

function ensureAvatarDir() {
  if (!fs.existsSync(AVATAR_DIR)) {
    fs.mkdirSync(AVATAR_DIR, { recursive: true });
  }
}

function resolveAvatarDiskPath(avatarUrl) {
  if (!avatarUrl || typeof avatarUrl !== 'string') return null;
  if (!avatarUrl.startsWith('/uploads/avatars/')) return null;
  return path.join(__dirname, '../..', avatarUrl.replace(/^\//, ''));
}

async function deleteAvatarFile(avatarUrl) {
  const diskPath = resolveAvatarDiskPath(avatarUrl);
  if (!diskPath || !fs.existsSync(diskPath)) return;
  try {
    await fs.promises.unlink(diskPath);
  } catch (error) {
    logger.debug(`Falha ao remover avatar antigo: ${error.message}`);
  }
}

function getInitials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
}

module.exports = {
  AVATAR_DIR,
  serializeUser,
  ensureUserProfileSchema,
  ensureAvatarDir,
  deleteAvatarFile,
  getInitials
};
