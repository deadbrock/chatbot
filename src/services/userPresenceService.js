const { Op } = require('sequelize');
const User = require('../models/UserSQL');

const STAFF_ROLES = ['agent', 'manager'];

async function countStaffUsers({ onlineOnly = false } = {}) {
  const where = {
    active: true,
    role: { [Op.in]: STAFF_ROLES }
  };

  if (onlineOnly) {
    where.status = 'online';
  }

  return User.count({ where });
}

async function getStaffPresenceSummary() {
  const [online, total] = await Promise.all([
    countStaffUsers({ onlineOnly: true }),
    countStaffUsers()
  ]);

  return {
    online,
    total,
    atendentesAtivos: `${online}/${total}`
  };
}

async function setUserPresence(userId, status) {
  const user = await User.findByPk(userId);
  if (!user || !user.active) return null;

  const updates = { status };
  if (status === 'online') {
    updates.lastLogin = new Date();
  }

  await user.update(updates);
  return user;
}

async function resetAllUsersOffline() {
  await User.update(
    { status: 'offline' },
    { where: { status: { [Op.ne]: 'offline' } } }
  );
}

module.exports = {
  STAFF_ROLES,
  countStaffUsers,
  getStaffPresenceSummary,
  setUserPresence,
  resetAllUsersOffline
};
