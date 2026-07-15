const Contact = require('../models/ContactSQL');
const logger = require('../utils/logger');

const PROFILE_PIC_TTL_MS = 24 * 60 * 60 * 1000;

function extractProfilePicUrl(result) {
  if (!result) return null;
  if (typeof result === 'string') return result.trim() || null;
  return result.eurl || result.imgFull || result.img || null;
}

async function fetchProfilePicUrl(client, chatId) {
  if (!client || !chatId) return null;

  try {
    if (typeof client.getProfilePicFromServer === 'function') {
      const pic = await client.getProfilePicFromServer(chatId);
      const url = extractProfilePicUrl(pic);
      if (url) return url;
    }
  } catch (err) {
    logger.debug(`getProfilePicFromServer falhou para ${chatId}: ${err.message}`);
  }

  try {
    const page = typeof client.page === 'function' ? await client.page() : client.page;
    if (page && typeof page.evaluate === 'function') {
      const url = await page.evaluate(async (id) => {
        if (window.WPP?.contact?.getProfilePictureUrl) {
          return window.WPP.contact.getProfilePictureUrl(id, true);
        }
        return null;
      }, chatId);
      if (url) return url;
    }
  } catch (err) {
    logger.debug(`WPP.contact.getProfilePictureUrl falhou para ${chatId}: ${err.message}`);
  }

  return null;
}

function isProfilePicStale(contact) {
  if (!contact?.profilePicUrl) return true;
  const fetchedAt = contact.metadata?.profilePicFetchedAt;
  if (!fetchedAt) return true;
  return Date.now() - new Date(fetchedAt).getTime() > PROFILE_PIC_TTL_MS;
}

async function updateContactProfilePic(client, contact, whatsappJid, { force = false } = {}) {
  if (!contact || !whatsappJid) return contact?.profilePicUrl || null;

  if (!force && !isProfilePicStale(contact)) {
    return contact.profilePicUrl;
  }

  const url = await fetchProfilePicUrl(client, whatsappJid);
  const updates = {
    metadata: {
      ...(contact.metadata || {}),
      profilePicFetchedAt: new Date().toISOString()
    }
  };

  if (url) {
    updates.profilePicUrl = url;
  }

  await contact.update(updates);
  await contact.reload();
  return contact.profilePicUrl || null;
}

async function refreshContactProfilePic(contactId, whatsappJid, { force = false } = {}) {
  const contact = await Contact.findByPk(contactId);
  if (!contact) return null;

  const jid = whatsappJid || contact.whatsappId;
  if (!jid) return contact.profilePicUrl || null;

  const whatsappClient = require('../bot/whatsapp');
  if (!(await whatsappClient.ensureReadyForSend())) {
    return contact.profilePicUrl || null;
  }

  return updateContactProfilePic(whatsappClient.client, contact, jid, { force });
}

module.exports = {
  fetchProfilePicUrl,
  isProfilePicStale,
  updateContactProfilePic,
  refreshContactProfilePic
};
