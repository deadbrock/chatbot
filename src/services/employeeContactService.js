const { Op } = require('sequelize');
const Contact = require('../models/ContactSQL');
const contactDisplayUtils = require('../utils/contactDisplayUtils');
const {
  EMPLOYEE_CATEGORY,
  REGISTERED_EMPLOYEE_SOURCES
} = require('../constants/employeeContact');
const logger = require('../utils/logger');

function buildWhatsappId(phone) {
  const digits = contactDisplayUtils.normalizePhoneDigits(phone);
  if (!digits) return null;
  return `${digits}@s.whatsapp.net`;
}

function phoneMatchKeys(phone, whatsappId) {
  const digits = contactDisplayUtils.normalizePhoneDigits(phone || whatsappId);
  if (!digits) return [];

  const keys = new Set([digits]);
  if (digits.startsWith('55') && digits.length > 10) {
    keys.add(digits.slice(2));
  } else if (digits.length >= 10 && digits.length <= 11) {
    keys.add(`55${digits}`);
  }

  if (digits.length >= 8) {
    keys.add(digits.slice(-9));
    keys.add(digits.slice(-8));
  }

  return [...keys];
}

function isRegisteredEmployee(contact) {
  if (!contact) return false;
  return contact.category === EMPLOYEE_CATEGORY
    && REGISTERED_EMPLOYEE_SOURCES.includes(contact.source);
}

async function findEmployeeByPhone({ phone, displayPhone, whatsappId } = {}) {
  const keys = phoneMatchKeys(displayPhone || phone, whatsappId);
  if (!keys.length) return null;

  const employees = await Contact.findAll({
    where: {
      category: EMPLOYEE_CATEGORY,
      source: { [Op.in]: REGISTERED_EMPLOYEE_SOURCES },
      isActive: true
    }
  });

  for (const employee of employees) {
    const employeeKeys = phoneMatchKeys(employee.phone, employee.whatsappId);
    if (keys.some((key) => employeeKeys.includes(key))) {
      return employee;
    }
  }

  if (whatsappId) {
    const byJid = employees.find((employee) => employee.whatsappId === whatsappId);
    if (byJid) return byJid;
  }

  return null;
}

async function linkEmployeeIdentifiers(employee, { phone, whatsappId } = {}) {
  if (!employee) return employee;

  const updates = {};
  const normalizedPhone = contactDisplayUtils.normalizePhoneDigits(phone);
  const jid = whatsappId || buildWhatsappId(phone);

  if (normalizedPhone && employee.phone !== normalizedPhone) {
    updates.phone = normalizedPhone;
  }
  if (jid && employee.whatsappId !== jid) {
    updates.whatsappId = jid;
  }

  if (Object.keys(updates).length) {
    await employee.update(updates);
    logger.info(`🔗 Funcionário ${employee.name} vinculado ao WhatsApp ${jid || normalizedPhone}`);
  }

  return employee;
}

function buildEmployeeFormData(contact) {
  return {
    nome_completo: contact.name,
    email: contact.email || null,
    contrato: contact.contract || null,
    cargo: contact.position || null,
    cidade: contact.city || null,
    estado: contact.state || null,
    is_employee: true,
    employee_contact_id: contact.id,
    employee_profile_loaded: true
  };
}

function employeeProfileIsComplete(formData = {}) {
  if (formData.is_employee && formData.employee_profile_loaded) {
    return true;
  }

  return Boolean(
    formData.nome_completo
    && formData.email
    && formData.contrato
  );
}

async function hydrateSessionFromEmployee(session, contact) {
  if (!session || !contact) return session;

  const profile = buildEmployeeFormData(contact);
  session.name = (contact.name || '').split(' ')[0] || session.name;
  session.formData = {
    ...(session.formData || {}),
    ...profile,
    collecting_data: false,
    missing_data: []
  };

  if (contact.email) session.email = contact.email;
  await session.save();
  return session;
}

module.exports = {
  buildWhatsappId,
  phoneMatchKeys,
  isRegisteredEmployee,
  findEmployeeByPhone,
  linkEmployeeIdentifiers,
  buildEmployeeFormData,
  employeeProfileIsComplete,
  hydrateSessionFromEmployee
};
