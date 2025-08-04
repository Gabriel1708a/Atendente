const makeWASocket = require('@whiskeysockets/baileys').default;
const { 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  useMultiFileAuthState,
  isJidBroadcast,
  isJidStatusBroadcast,
  Browsers
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const fs = require('fs');
const path = require('path');

// Importações dos módulos com tratamento de erro
let MessageHandler, AuthManager, InputManager;

try {
  MessageHandler = require('./handlers/messageHandler');
  AuthManager = require('./session/auth');
  InputManager = require('./utils/inputManager');
} catch (err) {
  console.error('❌ Erro ao importar módulos:', err.message);
  console.log('📝 Certifique-se de que os seguintes arquivos existem:');
  console.log('   - ./handlers/messageHandler.js');
  console.log('   - ./session/auth.js');
  console.log('   - ./utils/inputManager.js');
  process.exit(1);
}

class WhatsAppBot {
  constructor() {
    this.sock = null;
    this.authManager = null;
    this.inputManager = null;
    this.messageHandler = null;
    this.isConnected = false;
    this.pairingAttempted = false;
    this.sessionInvalidated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.isReconnecting = false;
    this.isShuttingDown = false;
    
    // Logger configurado corretamente
    this.logger = P({ 
      level: 'silent'
    });
    
    // Diretório para sessão
    this.sessionDir = path.join(__dirname, 'auth_info_baileys');
    
    this.init();
  }

  async init() {
    try {
      this.ensureSessionDir();
      
      // Inicializar managers com tratamento de erro
      this.authManager = new AuthManager();
      this.inputManager = new InputManager();
      
      console.log('✅ Bot inicializado com sucesso');
    } catch (err) {
      console.error('❌ Erro na inicialização:', err);
      throw err;
    }
  }

  ensureSessionDir() {
    try {
      if (!fs.existsSync(this.sessionDir)) {
        fs.mkdirSync(this.sessionDir, { recursive: true });
        console.log(`📁 Diretório de sessão criado: ${this.sessionDir}`);
      }
    } catch (err) {
      console.error('❌ Erro ao criar diretório de sessão:', err);
      throw err;
    }
  }

  async start() {
    console.log('🚀 Iniciando Bot de Atendimento WhatsApp...\n');
    
    // Tratamento de sinais do sistema
    this.setupProcessHandlers();
    
    try {
      // Verificar se existe sessão válida
      const hasSession = await this.checkExistingSession();
      
      if (!hasSession) {
        console.log('📱 Primeira execução - configurando conexão...');
        await this.setupFirstTimeConnection();
      } else {
        console.log('✅ Sessão existente encontrada');
      }
      
      await this.connect();
      
    } catch (err) {
      console.error('❌ Erro fatal ao iniciar bot:', err);
      await this.cleanup();
      process.exit(1);
    }
  }

  async checkExistingSession() {
    try {
      return this.authManager && this.authManager.hasExistingSession();
    } catch (err) {
      console.warn('⚠️ Erro ao verificar sessão existente:', err.message);
      return false;
    }
  }

  async setupFirstTimeConnection() {
    try {
      if (!this.inputManager) {
        throw new Error('InputManager não está disponível');
      }

      const method = await this.inputManager.askConnectionMethod();
      this.authManager.setConnectionMethod(method);
      
      if (method === 'code') {
        const phoneNumber = await this.inputManager.askPhoneNumber();
        this.authManager.setPhoneNumber(phoneNumber);
      }
      
      this.inputManager.closeInterface();
    } catch (err) {
      console.error('❌ Erro na configuração inicial:', err);
      throw err;
    }
  }

  async connect() {
    if (this.isReconnecting) {
      console.log('⏳ Reconexão já em andamento...');
      return;
    }

    if (this.isShuttingDown) {
      console.log('🛑 Bot está sendo encerrado, cancelando conexão...');
      return;
    }

    try {
      console.log('🔄 Estabelecendo conexão...');
      
      // Carregar estado de autenticação
      const { state, saveCreds } = await this.loadAuthState();
      
      // Obter versão mais recente do Baileys
      const { version, isLatest } = await fetchLatestBaileysVersion();
      console.log(`📦 Usando Baileys v${version.join('.')}, atualizado: ${isLatest}`);

      // Configurações do socket
      const socketOptions = {
        version,
        auth: state,
        logger: this.logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Bot Atendimento'),
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 60000,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        emitOwnEvents: false,
        fireInitQueries: true,
        shouldSyncHistoryMessage: () => false,
        getMessage: async (key) => {
          return { conversation: 'Mensagem não encontrada' };
        }
      };

      // IMPORTANTE: Força modo web para botões funcionarem
      socketOptions.mobile = false;
      
      // Configurações específicas para pareamento por código
      if (this.authManager?.getConnectionMethod() === 'code' && this.authManager?.getPhoneNumber()) {
        console.log('📱 Modo pareamento por código ativado');
      }

      // Criar socket
      this.sock = makeWASocket(socketOptions);
      
      // Inicializar handler de mensagens
      if (MessageHandler) {
        this.messageHandler = new MessageHandler(this.sock);
      }

      // Configurar listeners
      this.sock.ev.on('creds.update', saveCreds);
      this.setupEventHandlers();

      console.log('🔗 Socket WhatsApp criado com sucesso');

    } catch (err) {
      console.error('❌ Erro ao criar conexão:', err.message);
      
      if (err.message.includes('rate limited') || err.message.includes('too many requests')) {
        console.log('⏳ Rate limit detectado, aguardando 30s...');
        await this.delay(30000);
      }
      
      throw err;
    }
  }

  async loadAuthState() {
    try {
      return await useMultiFileAuthState(this.sessionDir);
    } catch (err) {
      console.error('❌ Erro ao carregar estado de auth:', err);
      
      // Tentar recuperar sessão corrompida
      try {
        if (fs.existsSync(this.sessionDir)) {
          const backupDir = `${this.sessionDir}_backup_${Date.now()}`;
          fs.renameSync(this.sessionDir, backupDir);
          console.log(`📦 Sessão corrompida movida para: ${backupDir}`);
        }
        
        fs.mkdirSync(this.sessionDir, { recursive: true });
        console.log('🔄 Nova sessão criada');
        
        return await useMultiFileAuthState(this.sessionDir);
      } catch (recoveryErr) {
        console.error('❌ Erro na recuperação da sessão:', recoveryErr);
        throw recoveryErr;
      }
    }
  }

  setupEventHandlers() {
    if (!this.sock) return;

    // Handler de atualização de conexão
    this.sock.ev.on('connection.update', async (update) => {
      try {
        await this.handleConnectionUpdate(update);
      } catch (err) {
        console.error('❌ Erro no handler de conexão:', err);
      }
    });

    // Handler de mensagens
    this.sock.ev.on('messages.upsert', async (m) => {
      try {
        await this.handleMessages(m);
      } catch (err) {
        console.error('❌ Erro no handler de mensagens:', err);
      }
    });

    // Handler de presença
    this.sock.ev.on('presence.update', (presence) => {
      // console.log('👤 Presença atualizada:', presence);
    });

    // Handler de grupos
    this.sock.ev.on('groups.upsert', (groups) => {
      // console.log('👥 Novos grupos:', groups.length);
    });

    // Handler de contatos
    this.sock.ev.on('contacts.upsert', (contacts) => {
      // console.log('📞 Contatos atualizados:', contacts.length);
    });

    // Handler de erro
    this.sock.ev.on('connection.error', (err) => {
      console.error('❌ Erro de conexão:', err);
    });
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;
    
    console.log(`🔄 Status da conexão: ${connection || 'conectando...'}`);

    // Exibir QR Code
    if (qr && !this.pairingAttempted) {
      this.displayQRCode(qr);
    }

    // Conexão estabelecida
    if (connection === 'open') {
      console.log('✅ Bot conectado com sucesso ao WhatsApp!');
      
      if (this.sock?.user) {
        console.log(`📱 Número: ${this.sock.user.id}`);
        console.log(`👤 Nome: ${this.sock.user.name || 'N/A'}`);
      }
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.pairingAttempted = false;
      
      // Marcar como online após conexão estabelecida
      await this.updatePresence('available');
      
      console.log('🎉 Bot pronto para receber mensagens!');
    }

    // Conexão fechada
    if (connection === 'close') {
      this.isConnected = false;
      if (!this.isShuttingDown) {
        await this.handleDisconnection(lastDisconnect);
      }
    }

    // Eventos adicionais
    if (isNewLogin) {
      console.log('🔐 Novo login detectado');
    }

    if (receivedPendingNotifications) {
      console.log('📬 Notificações pendentes recebidas');
    }
  }

  displayQRCode(qr) {
    console.log('\n┌────────── ESCANEIE O QR CODE ──────────┐');
    qrcode.generate(qr, { small: true });
    console.log('└────────────────────────────────────────┘');
    console.log('📱 Abra o WhatsApp > Dispositivos conectados > Conectar dispositivo');
    console.log('⏰ QR Code expira em 60 segundos\n');
    this.pairingAttempted = true;
  }

  async handleMessages(m) {
    if (m.type !== 'notify') return;
    if (!this.isConnected) return;

    for (const msg of m.messages) {
      try {
        // Filtros básicos
        if (msg.key.fromMe) continue;
        if (isJidBroadcast(msg.key.remoteJid)) continue;
        if (isJidStatusBroadcast(msg.key.remoteJid)) continue;
        if (!msg.message) continue;

        // Log da mensagem recebida
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        const messageType = Object.keys(msg.message)[0];
        
        console.log(`📨 Nova mensagem de ${isGroup ? 'grupo' : 'contato'}: ${from}`);
        console.log(`📄 Tipo: ${messageType}`);

        // Processar mensagem
        if (this.messageHandler) {
          await this.messageHandler.handleMessage(msg);
        } else {
          console.warn('⚠️ MessageHandler não disponível');
        }

      } catch (err) {
        console.error('❌ Erro ao processar mensagem:', err);
      }
    }
  }

  async handleDisconnection(lastDisconnect) {
    const reason = lastDisconnect?.error?.output?.statusCode;
    let shouldReconnect = true;
    let waitTime = this.reconnectDelay;

    console.log(`🔌 Conexão perdida. Código: ${reason}`);

    switch (reason) {
      case DisconnectReason.badSession:
        console.log('❌ Sessão inválida - removendo e recriando...');
        await this.clearSession();
        shouldReconnect = true;
        break;

      case DisconnectReason.connectionClosed:
        console.log('🔌 Conexão fechada pelo servidor');
        shouldReconnect = true;
        break;

      case DisconnectReason.connectionLost:
        console.log('📡 Conexão perdida');
        shouldReconnect = true;
        break;

      case DisconnectReason.connectionReplaced:
        console.log('🔄 Conexão substituída em outro dispositivo');
        shouldReconnect = false;
        break;

      case DisconnectReason.loggedOut:
        console.log('🚪 Deslogado do WhatsApp');
        await this.clearSession();
        shouldReconnect = false;
        break;

      case DisconnectReason.restartRequired:
        console.log('🔄 Reinicialização necessária');
        shouldReconnect = true;
        break;

      case DisconnectReason.timedOut:
        console.log('⏰ Timeout de conexão');
        shouldReconnect = true;
        waitTime = 10000;
        break;

      case DisconnectReason.unavailableService:
        console.log('🚫 Serviço indisponível');
        shouldReconnect = true;
        waitTime = 15000;
        break;

      default:
        console.log(`❓ Desconexão por motivo desconhecido: ${reason}`);
        shouldReconnect = true;
    }

    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts && !this.isShuttingDown) {
      this.reconnectAttempts++;
      this.isReconnecting = true;
      
      console.log(`🔄 Tentativa de reconexão ${this.reconnectAttempts}/${this.maxReconnectAttempts} em ${waitTime/1000}s...`);
      
      await this.delay(waitTime);
      
      try {
        await this.connect();
      } catch (err) {
        console.error('❌ Falha na reconexão:', err.message);
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          console.log('❌ Máximo de tentativas de reconexão atingido');
          await this.cleanup();
          process.exit(1);
        }
      }
    } else if (!shouldReconnect) {
      console.log('🛑 Encerrando bot por desconexão definitiva...');
      await this.cleanup();
      process.exit(0);
    } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('❌ Máximo de tentativas de reconexão atingido');
      await this.cleanup();
      process.exit(1);
    }
  }

  async clearSession() {
    try {
      if (fs.existsSync(this.sessionDir)) {
        const backupDir = `${this.sessionDir}_deleted_${Date.now()}`;
        fs.renameSync(this.sessionDir, backupDir);
        console.log(`🗑️ Sessão movida para: ${backupDir}`);
      }
      
      this.ensureSessionDir();
      this.pairingAttempted = false;
      
    } catch (err) {
      console.error('❌ Erro ao limpar sessão:', err);
    }
  }

  async updatePresence(presence = 'available') {
    try {
      if (this.sock && this.isConnected) {
        await this.sock.sendPresenceUpdate(presence);
      }
    } catch (err) {
      console.error('❌ Erro ao atualizar presença:', err);
    }
  }

  setupProcessHandlers() {
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 Recebido sinal ${signal} - encerrando bot graciosamente...`);
      this.isShuttingDown = true;
      await this.stop();
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown); // nodemon

    process.on('uncaughtException', async (err) => {
      console.error('❌ Exceção não capturada:', err);
      this.isShuttingDown = true;
      await this.cleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Promise rejeitada não tratada:', reason);
      console.error('Promise:', promise);
    });
  }

  async cleanup() {
    console.log('🧹 Limpando recursos...');
    
    try {
      if (this.inputManager) {
        this.inputManager.closeInterface();
      }

      if (this.sock) {
        this.sock.ev.removeAllListeners();
        this.sock = null;
      }

      this.messageHandler = null;
      
    } catch (err) {
      console.error('❌ Erro durante limpeza:', err);
    }
  }

  async stop() {
    console.log('🛑 Parando bot...');
    this.isShuttingDown = true;
    
    try {
      // Atualizar presença para unavailable
      await this.updatePresence('unavailable');
      
      // Fazer logout se conectado
      if (this.sock && this.isConnected) {
        console.log('🚪 Fazendo logout...');
        await this.sock.logout();
      }
      
    } catch (err) {
      console.error('❌ Erro durante parada:', err);
    } finally {
      await this.cleanup();
      console.log('✅ Bot parado com sucesso');
      process.exit(0);
    }
  }

  // Utilitários
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async sendMessage(jid, content, options = {}) {
    try {
      if (!this.isConnected) {
        throw new Error('Bot não está conectado');
      }
      
      if (!this.sock) {
        throw new Error('Socket não disponível');
      }
      
      return await this.sock.sendMessage(jid, content, options);
    } catch (err) {
      console.error('❌ Erro ao enviar mensagem:', err);
      throw err;
    }
  }

  // Getters
  get connected() {
    return this.isConnected;
  }

  get user() {
    return this.sock?.user || null;
  }

  get socket() {
    return this.sock;
  }
}

// Função de inicialização com tratamento de erro
async function initializeBot() {
  try {
    const bot = new WhatsAppBot();
    await bot.start();
    return bot;
  } catch (err) {
    console.error('❌ Erro fatal na inicialização do bot:', err);
    process.exit(1);
  }
}

// Verificar se está sendo executado diretamente
if (require.main === module) {
  initializeBot();
}

module.exports = WhatsAppBot;
