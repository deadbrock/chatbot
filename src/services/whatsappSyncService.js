const logger = require('../utils/logger');
const Contact = require('../models/ContactSQL');
const Conversation = require('../models/ConversationSQL');
const ChatMessage = require('../models/ChatMessageSQL');
const inboxConversationService = require('./inboxConversationService');
const whatsappProfilePicService = require('./whatsappProfilePicService');
const chatMediaUtils = require('../utils/chatMediaUtils');
const contactDisplayUtils = require('../utils/contactDisplayUtils');
const { extractMessageId, resolveWhatsAppTimestamp, resolveWhatsAppTimestampOrNow } = require('../utils/whatsappMessageUtils');
const { Op } = require('sequelize');

const DEFAULT_MESSAGES_PER_CHAT = parseInt(process.env.WHATSAPP_SYNC_MESSAGES_PER_CHAT || '0', 10);
const MAX_MESSAGES_PER_CHAT = parseInt(process.env.WHATSAPP_SYNC_MAX_MESSAGES_PER_CHAT || '5000', 10);
const ABSOLUTE_MAX_MESSAGES = parseInt(process.env.WHATSAPP_SYNC_ABSOLUTE_MAX_MESSAGES || '50000', 10);
const CHAT_PAGE_SIZE = parseInt(process.env.WHATSAPP_SYNC_CHATS_PAGE_SIZE || '100', 10);
const DELAY_BETWEEN_CHATS_MS = parseInt(process.env.WHATSAPP_SYNC_DELAY_MS || '200', 10);
const MESSAGE_BATCH_SIZE = parseInt(process.env.WHATSAPP_SYNC_MESSAGE_BATCH_SIZE || '50', 10);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeWapiMessage(msg) {
  if (!msg) return null;

  const id = extractId(msg.id) || msg.id?._serialized || msg.messageId || msg.id;
  if (!id) return null;

  return {
    id,
    body: msg.body || msg.content || msg.caption || '',
    type: msg.type,
    t: msg.t,
    timestamp: msg.timestamp || msg.t,
    fromMe: Boolean(msg.fromMe ?? msg.id?.fromMe),
    ack: msg.ack ?? 0,
    isMedia: Boolean(msg.isMedia || msg.isMMS || msg.mimetype || msg.hasMedia),
    isMMS: Boolean(msg.isMMS),
    mimetype: msg.mimetype || null,
    caption: msg.caption || '',
    from: msg.from?._serialized || msg.from || null,
    to: msg.to?._serialized || msg.to || null,
    hasMedia: Boolean(msg.isMedia || msg.isMMS || msg.mimetype || msg.hasMedia)
  };
}


function extractId(value) {
  return extractMessageId(value);
}

function shouldSkipChat(chatId) {
  if (!chatId) return true;
  if (chatId.includes('@g.us')) return true;
  if (chatId.includes('@broadcast')) return true;
  if (chatId === 'status@broadcast') return true;
  return false;
}

function resolveMessageBody(msg) {
  const type = chatMediaUtils.normalizeMessageType(msg.type);
  const hasMedia = Boolean(msg.isMedia || msg.isMMS || msg.mimetype || msg.hasMedia);

  if (hasMedia) {
    const caption = msg.caption || msg.body || msg.content || '';
    if (caption && !chatMediaUtils.isBase64Payload(String(caption))) {
      return String(caption).trim();
    }
    return chatMediaUtils.getMediaPreviewLabel(type, true);
  }

  const body = msg.body || msg.content || msg.caption || '';
  if (body && String(body).trim() && !chatMediaUtils.isBase64Payload(String(body))) {
    return String(body).trim();
  }

  return chatMediaUtils.getMediaPreviewLabel(type, hasMedia) || '';
}

function resolveTimestamp(msg) {
  return resolveWhatsAppTimestamp(msg) || resolveWhatsAppTimestampOrNow(msg, { allowNow: false });
}

function resolveFromMe(msg) {
  if (typeof msg?.fromMe === 'boolean') return msg.fromMe;
  const id = extractId(msg?.id);
  if (typeof id === 'string' && id.includes('_')) {
    return id.startsWith('true_');
  }
  return Boolean(msg?.fromMe);
}

function sortMessagesChronologically(messages) {
  return [...messages].sort((a, b) => {
    const tsA = resolveTimestamp(a);
    const tsB = resolveTimestamp(b);
    if (!tsA && !tsB) return 0;
    if (!tsA) return -1;
    if (!tsB) return 1;
    return tsA - tsB;
  });
}

function syncMessagesTotal(stats = {}) {
  return (Number(stats.messagesImported) || 0) + (Number(stats.messagesUpdated) || 0);
}

function mapMessageStatus(msg) {
  const fromMe = resolveFromMe(msg);
  if (fromMe) {
    if (msg.ack === 3) return 'read';
    if (msg.ack === 2) return 'delivered';
    return 'sent';
  }
  return 'delivered';
}

function emitSocket(event, data) {
  try {
    const io = global.io || require('../server').io;
    if (io) io.emit(event, data);
  } catch (err) {
    logger.debug(`Socket não disponível para ${event}:`, err.message);
  }
}

class WhatsappSyncService {
  constructor() {
    this.syncInProgress = false;
    this.lastSyncAt = null;
    this.lastStats = null;
    this.currentProgress = null;
  }

  getStatus() {
    return {
      syncInProgress: this.syncInProgress,
      lastSyncAt: this.lastSyncAt,
      lastStats: this.lastStats,
      progress: this.currentProgress
    };
  }

  buildProgressPatch(patch = {}) {
    const prev = this.currentProgress || {};
    const merged = {
      status: 'running',
      phase: 'syncing_chats',
      percent: 0,
      chatsFound: 0,
      chatsToSync: 0,
      chatsProcessed: 0,
      chatsSkipped: 0,
      messagesImported: 0,
      messagesUpdated: 0,
      messagesSkipped: 0,
      conversationsEnsured: 0,
      conversationsCreated: 0,
      errors: 0,
      message: '',
      ...prev,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    if (merged.status === 'completed') {
      merged.percent = 100;
    } else if (merged.status === 'error') {
      merged.percent = Math.max(0, Math.min(99, Number(merged.percent) || 0));
    } else if (merged.status === 'counting') {
      merged.percent = Math.min(5, Math.max(1, Number(merged.percent) || 2));
    } else if (merged.chatsToSync > 0) {
      const processed = Number(merged.chatsProcessed) || 0;
      merged.percent = Math.min(99, 5 + Math.round((processed / merged.chatsToSync) * 94));
    } else if (merged.status === 'started') {
      merged.percent = 1;
    }

    merged.messagesSynced = syncMessagesTotal(merged);

    return merged;
  }

  emitProgress(patch = {}) {
    try {
      this.currentProgress = this.buildProgressPatch(patch);
      emitSocket('whatsapp_sync_progress', this.currentProgress);
    } catch (err) {
      logger.debug('Falha ao emitir progresso de sync:', err.message);
    }
  }

  async startSync(whatsappClient, { force = false } = {}) {
    if (!whatsappClient?.client) {
      throw new Error('Cliente WhatsApp não disponível para sincronização');
    }

    if (this.syncInProgress) {
      logger.info('🔄 Sincronização WhatsApp já em andamento');
      if (this.currentProgress) {
        this.emitProgress(this.currentProgress);
      }
      return this.lastStats;
    }

    if (!force && this.lastSyncAt) {
      const elapsed = Date.now() - new Date(this.lastSyncAt).getTime();
      if (elapsed < 5 * 60 * 1000) {
        logger.info('⏭️ Sincronização recente — ignorando nova execução');
        return this.lastStats;
      }
    }

    this.syncInProgress = true;
    this.currentProgress = null;
    whatsappClient.loadingMessage = 'Sincronizando conversas do WhatsApp...';

    this.emitProgress({
      status: 'started',
      phase: 'starting',
      percent: 1,
      message: 'Preparando sincronização do WhatsApp...'
    });

    try {
      const stats = await this.syncAllConversations(whatsappClient.client);
      this.lastSyncAt = new Date();
      this.lastStats = stats;

      logger.info(`✅ Sync WhatsApp concluído: ${stats.conversationsEnsured} conversas, ${stats.chatsProcessed} chats, ${stats.messagesImported} novas, ${stats.messagesUpdated || 0} corrigidas`);

      this.emitProgress({
        status: 'completed',
        phase: 'done',
        percent: 100,
        chatsFound: stats.chatsFound,
        chatsToSync: stats.chatsToSync,
        chatsProcessed: stats.chatsProcessed,
        chatsSkipped: stats.chatsSkipped,
        messagesImported: stats.messagesImported,
        messagesUpdated: stats.messagesUpdated || 0,
        messagesSkipped: stats.messagesSkipped,
        conversationsEnsured: stats.conversationsEnsured,
        conversationsCreated: stats.conversationsCreated,
        ticketsEnsured: stats.conversationsEnsured,
        ticketsCreated: stats.conversationsCreated,
        errors: stats.errors,
        message: `Sincronização concluída: ${stats.conversationsEnsured} conversas, ${syncMessagesTotal(stats)} mensagens`
      });

      emitSocket('whatsapp_sync_complete', { success: true, stats, progress: this.currentProgress });
      return stats;
    } catch (error) {
      logger.error('❌ Erro na sincronização WhatsApp:', error);
      this.emitProgress({
        status: 'error',
        phase: 'error',
        message: error.message || 'Erro na sincronização'
      });
      emitSocket('whatsapp_sync_complete', {
        success: false,
        error: error.message,
        progress: this.currentProgress
      });
      throw error;
    } finally {
      this.syncInProgress = false;
      whatsappClient.loadingMessage = '';
    }
  }

  async syncAllConversations(client) {
    const stats = {
      chatsFound: 0,
      chatsToSync: 0,
      chatsProcessed: 0,
      chatsSkipped: 0,
      contactsCreated: 0,
      contactsUpdated: 0,
      ticketsCreated: 0,
      ticketsEnsured: 0,
      ticketsReopened: 0,
      messagesImported: 0,
      messagesUpdated: 0,
      messagesSkipped: 0,
      errors: 0
    };

    await this.waitForHistorySync(client);

    this.emitProgress({
      status: 'counting',
      phase: 'counting_chats',
      percent: 2,
      message: 'Contando conversas no WhatsApp...'
    });

    const chats = await this.fetchAllChats(client, (count) => {
      this.emitProgress({
        status: 'counting',
        phase: 'counting_chats',
        chatsFound: count,
        percent: 3,
        message: `Contando conversas no WhatsApp... ${count} encontradas`
      });
    });
    stats.chatsFound = chats.length;

    const syncableChats = [];
    for (const chat of chats) {
      const chatId = extractId(chat.id) || chat.id?._serialized || chat.id;
      if (shouldSkipChat(chatId)) {
        stats.chatsSkipped += 1;
        continue;
      }
      syncableChats.push({ chat, chatId });
    }

    stats.chatsToSync = syncableChats.length;

    logger.info(`📥 Sync: ${stats.chatsFound} conversas encontradas, ${stats.chatsToSync} para sincronizar`);

    this.emitProgress({
      status: 'running',
      phase: 'syncing_chats',
      chatsFound: stats.chatsFound,
      chatsToSync: stats.chatsToSync,
      chatsProcessed: 0,
      chatsSkipped: stats.chatsSkipped,
      messagesImported: 0,
      messagesUpdated: 0,
      messagesSkipped: 0,
      conversationsEnsured: 0,
      conversationsCreated: 0,
      errors: 0,
      message: stats.chatsToSync
        ? `${stats.chatsToSync} conversas encontradas. Importando mensagens...`
        : 'Nenhuma conversa individual encontrada para sincronizar.'
    });

    if (!syncableChats.length) {
      return stats;
    }

    for (let i = 0; i < syncableChats.length; i++) {
      const { chat, chatId } = syncableChats[i];

      try {
        const result = await this.syncChat(client, chat, chatId);
        stats.chatsProcessed += 1;
        stats.contactsCreated += result.contactsCreated;
        stats.contactsUpdated += result.contactsUpdated;
        stats.conversationsCreated += result.conversationsCreated;
        stats.conversationsEnsured += result.conversationsEnsured;
        stats.ticketsCreated += result.conversationsCreated;
        stats.ticketsEnsured += result.conversationsEnsured;
        stats.messagesImported += result.messagesImported;
        stats.messagesUpdated += result.messagesUpdated || 0;
        stats.messagesSkipped += result.messagesSkipped;

        this.emitProgress({
          status: 'running',
          phase: 'syncing_chats',
          chatsFound: stats.chatsFound,
          chatsToSync: stats.chatsToSync,
          chatsProcessed: stats.chatsProcessed,
          chatsSkipped: stats.chatsSkipped,
          messagesImported: stats.messagesImported,
          messagesUpdated: stats.messagesUpdated,
          messagesSkipped: stats.messagesSkipped,
          conversationsEnsured: stats.conversationsEnsured,
          conversationsCreated: stats.conversationsCreated,
          ticketsEnsured: stats.conversationsEnsured,
          ticketsCreated: stats.conversationsCreated,
          errors: stats.errors,
          currentChat: stats.chatsProcessed,
          message: `Sincronizando conversa ${stats.chatsProcessed} de ${stats.chatsToSync} • ${syncMessagesTotal(stats)} mensagens`
        });
      } catch (err) {
        stats.errors += 1;
        stats.chatsProcessed += 1;
        logger.warn(`⚠️ Erro ao sincronizar chat ${chatId}: ${err.message}`);

        this.emitProgress({
          status: 'running',
          phase: 'syncing_chats',
          chatsFound: stats.chatsFound,
          chatsToSync: stats.chatsToSync,
          chatsProcessed: stats.chatsProcessed,
          chatsSkipped: stats.chatsSkipped,
          messagesImported: stats.messagesImported,
          messagesUpdated: stats.messagesUpdated,
          messagesSkipped: stats.messagesSkipped,
          conversationsEnsured: stats.conversationsEnsured,
          conversationsCreated: stats.conversationsCreated,
          ticketsEnsured: stats.conversationsEnsured,
          ticketsCreated: stats.conversationsCreated,
          errors: stats.errors,
          currentChat: stats.chatsProcessed,
          message: `Erro em 1 conversa. Continuando (${stats.chatsProcessed}/${stats.chatsToSync})...`
        });
      }

      await sleep(DELAY_BETWEEN_CHATS_MS);
    }

    return stats;
  }

  async fetchAllChats(client, onCount) {
    const unique = new Map();

    const notifyCount = () => {
      if (typeof onCount === 'function') onCount(unique.size);
    };

    const addBatch = (batch) => {
      if (!Array.isArray(batch)) return 0;
      let added = 0;
      for (const chat of batch) {
        const chatId = extractId(chat.id) || chat.id?._serialized || chat.id;
        if (chatId && !unique.has(chatId)) {
          unique.set(chatId, chat);
          added += 1;
        }
      }
      if (added > 0) notifyCount();
      return added;
    };

    const paginateListChats = async (baseOptions = {}) => {
      if (typeof client.listChats !== 'function') return 0;

      let totalAdded = 0;
      let params = { count: CHAT_PAGE_SIZE, ...baseOptions };

      while (true) {
        let batch = [];
        try {
          batch = await client.listChats(params);
        } catch (err) {
          logger.warn(`listChats falhou (${JSON.stringify(baseOptions)}):`, err.message);
          break;
        }

        if (!Array.isArray(batch) || batch.length === 0) break;

        totalAdded += addBatch(batch);

        if (batch.length < CHAT_PAGE_SIZE) break;

        const oldest = batch[batch.length - 1];
        const oldestId = extractId(oldest.id);
        if (!oldestId) break;

        params = {
          ...baseOptions,
          count: CHAT_PAGE_SIZE,
          direction: 'before',
          id: oldestId
        };

        await sleep(120);
      }

      return totalAdded;
    };

    // Conversas individuais (paginado)
    await paginateListChats({ onlyUsers: true });
    // Complemento: todas as conversas (inclui arquivadas; grupos são filtrados depois)
    await paginateListChats({});

    if (typeof client.getAllChats === 'function') {
      try {
        const all = await client.getAllChats(false);
        const added = addBatch(all);
        if (added > 0) {
          logger.info(`📥 getAllChats complementou +${added} conversas`);
        }
      } catch (err) {
        logger.warn('getAllChats falhou:', err.message);
      }
    }

    const chats = Array.from(unique.values());
    logger.info(`📥 ${chats.length} conversas únicas carregadas do WhatsApp`);
    return chats;
  }

  async syncChat(client, chat, chatId) {
    const result = {
      contactsCreated: 0,
      contactsUpdated: 0,
      conversationsCreated: 0,
      conversationsEnsured: 0,
      messagesImported: 0,
      messagesSkipped: 0,
      messagesUpdated: 0
    };

    const identity = await this.resolveChatIdentity(client, chat, chatId);
    const { jid, phone, displayPhone, name } = identity;

    const { contact, updated } = await this.resolveRegisteredEmployeeContact(jid, phone, displayPhone, name);
    if (updated) result.contactsUpdated += 1;

    if (contact) {
      try {
        await whatsappProfilePicService.updateContactProfilePic(client, contact, jid);
      } catch (err) {
        logger.debug(`Foto de perfil não obtida para ${jid}: ${err.message}`);
      }
    }

    const { conversation, created: conversationCreated } = await inboxConversationService.ensureConversation(
      contact,
      identity,
      'whatsapp_sync'
    );
    result.conversationsEnsured = 1;
    if (conversationCreated) result.conversationsCreated += 1;

    const messageLimit = DEFAULT_MESSAGES_PER_CHAT > 0
      ? DEFAULT_MESSAGES_PER_CHAT
      : ABSOLUTE_MAX_MESSAGES;

    const messages = await this.fetchChatMessages(client, jid, messageLimit, {
      fetchAll: DEFAULT_MESSAGES_PER_CHAT <= 0,
      chat
    });

    if (!messages.length) {
      logger.debug(`Sync ${jid}: nenhuma mensagem retornada do WhatsApp`);
      return result;
    }

    let lastTs = null;
    for (const msg of messages) {
      const mapped = this.mapMessageToRow(msg, conversation.id, contact?.id || null, phone, name, jid);
      if (!mapped) {
        result.messagesSkipped += 1;
        continue;
      }

      try {
        const upsertResult = await this.upsertSyncedMessage(mapped);
        if (upsertResult.created) result.messagesImported += 1;
        if (upsertResult.updated) result.messagesUpdated += 1;
        if (mapped.timestamp) lastTs = mapped.timestamp;
      } catch (err) {
        result.messagesSkipped += 1;
        logger.warn(`⚠️ Falha ao salvar mensagem ${mapped.messageId}: ${err.message}`);
      }
    }

    if (lastTs) {
      await Conversation.update(
        { lastMessageAt: lastTs, updatedAt: lastTs },
        { where: { id: conversation.id } }
      );
      if (contact) {
        await contact.update({ lastInteraction: lastTs });
      }
    }

    return result;
  }

  async resolveChatIdentity(client, chat, chatId) {
    const jid = chatId;
    const suffix = jid.split('@')[1] || '';
    const prefix = jid.split('@')[0];

    let displayPhone = null;
    let phone = prefix;

    const contactRef = chat?.contact || {};
    const contactJid = extractId(contactRef.id) || contactRef.id;
    if (contactJid && String(contactJid).includes('@c.us')) {
      displayPhone = String(contactJid).split('@')[0];
      phone = displayPhone;
    }

    if (!displayPhone && typeof client.getContact === 'function') {
      try {
        const remote = await client.getContact(jid);
        const remoteJid = extractId(remote?.id) || remote?.id;
        if (remoteJid && String(remoteJid).includes('@c.us')) {
          displayPhone = String(remoteJid).split('@')[0];
          phone = displayPhone;
        }
      } catch (err) {
        logger.debug(`getContact falhou para ${jid}:`, err.message);
      }
    }

    if (!displayPhone && suffix === 'lid' && typeof client.getPnLidEntry === 'function') {
      try {
        const entry = await client.getPnLidEntry(jid);
        const phoneJid = entry?.phoneNumber?._serialized
          || (entry?.phoneNumber?.user
            ? `${entry.phoneNumber.user}@${entry.phoneNumber.server || 'c.us'}`
            : null);
        if (phoneJid && phoneJid.includes('@c.us')) {
          displayPhone = phoneJid.split('@')[0];
          phone = displayPhone;
        }
      } catch (err) {
        logger.debug(`getPnLidEntry em resolveChatIdentity(${jid}): ${err.message}`);
      }
    }

    if (!displayPhone && suffix !== 'lid' && contactDisplayUtils.isValidPhoneDigits(prefix)) {
      displayPhone = prefix;
      phone = prefix;
    }

    const rawName = chat?.name
      || contactRef.pushname
      || contactRef.name
      || contactRef.formattedName
      || chat?.formattedTitle
      || '';
    const storedName = contactDisplayUtils.resolveContactNameForStorage(rawName, displayPhone || phone);
    const name = storedName || rawName || 'Contato';

    return { jid, phone, displayPhone, name };
  }

  async upsertSyncedMessage(row) {
    const existing = await ChatMessage.findOne({ where: { messageId: row.messageId } });

    if (existing) {
      await existing.update({
        timestamp: row.timestamp,
        createdAt: row.timestamp,
        updatedAt: row.timestamp,
        body: row.body,
        status: row.status,
        ack: row.ack,
        type: row.type,
        hasMedia: row.hasMedia,
        metadata: row.metadata
      });
      return { created: false, updated: true };
    }

    await ChatMessage.create(row);
    return { created: true, updated: false };
  }

  async resolveMessageChatIds(client, chatId) {
    const candidates = [];
    const push = (id) => {
      if (id && typeof id === 'string' && !candidates.includes(id)) {
        candidates.push(id);
      }
    };

    push(chatId);

    if (chatId.includes('@lid')) {
      if (typeof client.getPnLidEntry === 'function') {
        try {
          const entry = await client.getPnLidEntry(chatId);
          push(entry?.lid?._serialized);
        } catch (err) {
          logger.debug(`getPnLidEntry(${chatId}): ${err.message}`);
        }
      }
    }

    return candidates;
  }

  async waitForHistorySync(client, maxWaitMs = 180000) {
    if (!client?.page?.evaluate) return;

    const start = Date.now();
    let lastProgress = null;

    while (Date.now() - start < maxWaitMs) {
      try {
        const state = await client.page.evaluate(() => {
          if (typeof WPP === 'undefined' || !WPP.conn?.getHistorySyncProgress) {
            return { inProgress: false, progress: 100 };
          }
          const info = WPP.conn.getHistorySyncProgress();
          return {
            inProgress: Boolean(info?.inProgress),
            progress: info?.progress,
            paused: Boolean(info?.paused)
          };
        });

        if (!state.inProgress) {
          if (lastProgress !== null) {
            logger.info('✅ Histórico WhatsApp sincronizado no navegador');
          }
          return;
        }

        if (state.progress !== lastProgress) {
          lastProgress = state.progress;
          logger.info(`⏳ Aguardando histórico WhatsApp: ${state.progress ?? '?'}%`);
          this.emitProgress({
            status: 'running',
            phase: 'waiting_history',
            message: `Aguardando histórico do WhatsApp (${state.progress ?? '?'}%)...`
          });
        }

        await sleep(3000);
      } catch (err) {
        logger.debug(`waitForHistorySync: ${err.message}`);
        return;
      }
    }

    logger.warn('⚠️ Timeout aguardando histórico WhatsApp — importando mensagens já em cache');
  }

  async fetchMessagesInBrowser(client, chatId, { hardLimit, fetchAll }) {
    if (!client?.page?.evaluate) {
      throw new Error('Página do WhatsApp indisponível');
    }

    return client.page.evaluate(async ({ chatId, hardLimit, fetchAll }) => {
      const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const results = new Map();

      function serializeMsg(msg) {
        if (!msg) return null;
        const rawId = msg.id;
        const id = (typeof rawId === 'object')
          ? (rawId._serialized || rawId.id || null)
          : rawId;
        if (!id) return null;

        return {
          id,
          body: msg.body || msg.caption || msg.content || '',
          type: msg.type,
          t: msg.t,
          timestamp: msg.t || msg.timestamp,
          fromMe: Boolean(rawId?.fromMe ?? msg.fromMe ?? msg.isSentByMe),
          ack: msg.ack ?? 0,
          isMedia: Boolean(msg.isMedia || msg.isMMS),
          isMMS: Boolean(msg.isMMS),
          mimetype: msg.mimetype || null,
          caption: msg.caption || '',
          from: msg.from?._serialized || msg.from || null,
          to: msg.to?._serialized || msg.to || null,
          hasMedia: Boolean(msg.isMedia || msg.isMMS || msg.mimetype)
        };
      }

      function collectMsgs(source) {
        if (!source) return 0;
        let added = 0;
        let arr = [];
        if (Array.isArray(source)) arr = source;
        else if (typeof source.getModelsArray === 'function') arr = source.getModelsArray();
        else if (Array.isArray(source._models)) arr = source._models;
        else if (Array.isArray(source.models)) arr = source.models;

        for (const msg of arr) {
          const row = serializeMsg(msg);
          if (row && !results.has(row.id)) {
            results.set(row.id, row);
            added += 1;
          }
        }
        return added;
      }

      async function getChat(id) {
        if (typeof WPP === 'undefined') return null;
        try {
          if (WPP.chat?.get) {
            const found = WPP.chat.get(id);
            if (found) return found;
          }
        } catch (_) { /* ignore */ }
        try {
          if (WPP.chat?.find) return await WPP.chat.find(id);
        } catch (_) { /* ignore */ }
        try {
          const store = WPP.whatsapp?.ChatStore;
          if (store?.get) {
            const wid = WPP.util?.createWid ? WPP.util.createWid(id) : id;
            return store.get(wid) || store.get(id);
          }
        } catch (_) { /* ignore */ }
        return null;
      }

      async function tryLoadEarlier(chat) {
        const candidates = [
          chat?.msgs?.loadEarlierMsgs?.bind(chat.msgs),
          chat?.loadEarlierMsgs?.bind(chat),
          chat?.msgs?.loadEarlier?.bind(chat.msgs)
        ].filter((fn) => typeof fn === 'function');

        for (const fn of candidates) {
          try {
            const batch = await fn();
            if (batch) return batch;
          } catch (_) { /* ignore */ }
        }
        return null;
      }

      async function tryLoadRecent(chat) {
        if (typeof chat?.loadRecentMsgs !== 'function') return null;
        try {
          return await chat.loadRecentMsgs();
        } catch (_) {
          return null;
        }
      }

      function collectFromMsgStore(id) {
        const store = WPP?.whatsapp?.MsgStore;
        if (!store) return 0;

        let arr = [];
        try {
          if (typeof store.getModelsArray === 'function') arr = store.getModelsArray();
          else if (Array.isArray(store._models)) arr = store._models;
        } catch (_) {
          return 0;
        }

        let added = 0;
        for (const msg of arr) {
          const remote = msg?.id?.remote?._serialized
            || msg?.id?.remote
            || msg?.chatId?._serialized
            || msg?.chatId;
          if (remote !== id) continue;
          const row = serializeMsg(msg);
          if (row && !results.has(row.id)) {
            results.set(row.id, row);
            added += 1;
          }
          if (results.size >= hardLimit) break;
        }
        return added;
      }

      const chat = await getChat(chatId);
      if (chat) {
        collectMsgs(chat.msgs);
        if (Array.isArray(chat.msgChunks)) {
          for (const chunk of chat.msgChunks) collectMsgs(chunk);
        }
        if (typeof chat.getAllCMCs === 'function') {
          try {
            for (const cmc of chat.getAllCMCs()) collectMsgs(cmc);
          } catch (_) { /* ignore */ }
        }

        collectMsgs(await tryLoadRecent(chat));

        if (fetchAll) {
          for (let round = 0; round < 300 && results.size < hardLimit; round += 1) {
            const state = chat.msgs?.msgLoadState;
            if (state?.noEarlierMsgs) break;

            const before = results.size;
            collectMsgs(await tryLoadEarlier(chat));
            collectMsgs(chat.msgs);
            if (results.size === before) break;
            await delay(100);
          }
        }
      }

      if (results.size < hardLimit) {
        collectFromMsgStore(chatId);
      }

      return Array.from(results.values()).slice(-hardLimit);
    }, { chatId, hardLimit, fetchAll });
  }

  async fetchMessagesViaMsgStore(client, targetId, hardLimit, { fetchAll = false } = {}) {
    const unique = new Map();

    const mergeBatch = (batch) => {
      if (!Array.isArray(batch)) return 0;
      let added = 0;
      for (const raw of batch) {
        const msg = normalizeWapiMessage(raw);
        const id = extractId(msg?.id);
        if (id && !unique.has(id)) {
          unique.set(id, msg);
          added += 1;
        }
      }
      return added;
    };

    try {
      const browserRows = await this.fetchMessagesInBrowser(client, targetId, { hardLimit, fetchAll });
      const added = mergeBatch(browserRows);
      if (added > 0) {
        logger.debug(`📨 ${targetId}: ${added} mensagens via MsgStore/browser`);
        return unique;
      }
    } catch (err) {
      logger.debug(`fetchMessagesInBrowser falhou (${targetId}): ${err.message}`);
    }

    if (typeof client.getAllMessagesInChat === 'function') {
      try {
        const loaded = await client.getAllMessagesInChat(targetId, true, false);
        const added = mergeBatch(loaded);
        if (added > 0) {
          logger.debug(`📨 ${targetId}: ${added} mensagens via getAllMessagesInChat`);
        }
      } catch (err) {
        logger.debug(`getAllMessagesInChat falhou (${targetId}): ${err.message}`);
      }
    }

    return unique;
  }

  async fetchMessagesForChatId(client, targetId, hardLimit, { fetchAll = false } = {}) {
    return this.fetchMessagesViaMsgStore(client, targetId, hardLimit, { fetchAll });
  }

  async fetchChatMessages(client, chatId, maxMessages, { fetchAll = false, chat = null } = {}) {
    const hardLimit = fetchAll
      ? ABSOLUTE_MAX_MESSAGES
      : (maxMessages > 0 ? maxMessages : MAX_MESSAGES_PER_CHAT);

    const unique = new Map();
    const chatIds = await this.resolveMessageChatIds(client, chatId);

    if (chat?.id) {
      const serialized = extractId(chat.id);
      if (serialized && !chatIds.includes(serialized)) {
        chatIds.unshift(serialized);
      }
    }

    for (const targetId of chatIds) {
      const before = unique.size;

      try {
        const fetched = await this.fetchMessagesForChatId(client, targetId, hardLimit, { fetchAll });
        for (const [id, msg] of fetched.entries()) {
          if (!unique.has(id)) unique.set(id, msg);
        }
      } catch (err) {
        logger.warn(`Falha ao buscar mensagens (${targetId}): ${err.message}`);
      }

      if (unique.size > before) {
        logger.debug(`📨 Sync mensagens: ${unique.size - before} obtidas via ${targetId}`);
        break;
      }
    }

    return sortMessagesChronologically(Array.from(unique.values())).slice(-hardLimit);
  }

  /**
   * Busca funcionário cadastrado manualmente — NÃO cria contato automaticamente.
   */
  async resolveRegisteredEmployeeContact(whatsappId, phone, displayPhone, name) {
    const employeeContactService = require('./employeeContactService');
    const employee = await employeeContactService.findEmployeeByPhone({
      phone: displayPhone || phone,
      whatsappId
    });

    if (!employee) {
      return { contact: null, created: false, updated: false };
    }

    const linked = await employeeContactService.linkEmployeeIdentifiers(employee, {
      phone: displayPhone || phone,
      whatsappId
    });

    let updated = false;
    if (name && linked.name !== name && require('../utils/contactDisplayUtils').isGenericContactName(linked.name)) {
      await linked.update({ name });
      updated = true;
    }

    return { contact: linked, created: false, updated };
  }

  /** @deprecated use resolveRegisteredEmployeeContact */
  async upsertContact(whatsappId, phone, displayPhone, name) {
    return this.resolveRegisteredEmployeeContact(whatsappId, phone, displayPhone, name);
  }

  mapMessageToRow(msg, conversationId, contactId, phone, name, chatId) {
    const messageId = extractId(msg.id);
    if (!messageId) return null;

    const body = resolveMessageBody(msg)
      || chatMediaUtils.getMediaPreviewLabel(chatMediaUtils.normalizeMessageType(msg.type), Boolean(msg.isMedia || msg.isMMS))
      || 'Mensagem';

    const fromMe = resolveFromMe(msg);
    const timestamp = resolveTimestamp(msg);
    if (!timestamp) {
      logger.debug(`⏭️ Mensagem ignorada no sync (sem timestamp): ${messageId}`);
      return null;
    }

    return {
      messageId,
      conversationId,
      ticketId: null,
      contactId,
      direction: fromMe ? 'outgoing' : 'incoming',
      from: fromMe ? 'agent' : phone,
      to: fromMe ? chatId : 'bot',
      fromName: fromMe ? 'Você' : (name || phone),
      body,
      type: chatMediaUtils.normalizeMessageType(msg.type) || 'text',
      status: mapMessageStatus(msg),
      fromMe,
      timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
      ack: msg.ack || 0,
      hasMedia: Boolean(msg.isMedia || msg.isMMS || msg.mimetype),
      metadata: {
        synced: true,
        chatId,
        originalTimestamp: timestamp.toISOString()
      }
    };
  }
}

module.exports = new WhatsappSyncService();
