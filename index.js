const makeWASocket = require('@whiskeysockets/baileys').default;
const { 
  DisconnectReason, 
  fetchLatestBaileysVersion, 
  useMultiFileAuthState,
  isJidBroadcast,
  isJidStatusBroadcast 
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');
const fs = require('fs');
const path = require('path');

// Importações dos módulos (certifique-se que existem)
const MessageHandler = require('./handlers/messageHandler');
const AuthManager = require('./session/auth');
const InputManager = require('./utils/inputManager');

class WhatsAppBot {
  constructor() {
    this.sock = null;
    this.authManager = new AuthManager();
    this.inputManager = new InputManager();
    this.messageHandler = null;
    this.isConnected = false;
    this.pairingAttempted = false;
    this.sessionInvalidated = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 5000;
    this.isReconnecting = false;
    this.logger = P({ 
      level: 'silent',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true
        }
      }
    });
    
    // Diretório para sessão
    this.sessionDir = './auth_info_baileys';
    this.ensureSessionDir();
  }

  ensureSessionDir() {
    if (!fs.existsSync(this.sessionDir)) {
      fs.mkdirSync(this.sessionDir, { recursive: true });
      console.log('📁 Diretório de sessão criado:', this.sessionDir);
    }
  }

  async start() {
    console.log('🚀 Iniciando Bot de Atendimento WhatsApp...\n');
    
    // Tratamento de sinais do sistema
    this.setupProcessHandlers();
    
    try {
      // Verificar se existe sessão válida
      if (!this.authManager.hasExistingSession()) {
        console.log('📱 Primeira execução - configurando conexão...');
        const method = await this.inputManager.askConnectionMethod();
        this.authManager.setConnectionMethod(method);
        
        if (method === 'code') {
          const phoneNumber = await this.inputManager.askPhoneNumber();
          this.authManager.setPhoneNumber(phoneNumber);
        }
        
        this.inputManager.closeInterface();
      } else {
        console.log('✅ Sessão existente encontrada');
      }
      
      await this.connect();
      
    } catch (err) {
      console.error('❌ Erro fatal ao iniciar bot:', err);
      this.cleanup();
      process.exit(1);
    }
  }

  async connect() {
    if (this.isReconnecting) {
      console.log('⏳ Reconexão já em andamento...');
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
        browser: ['Bot Atendimento', 'Chrome', '3.0.0'],
        generateHighQualityLinkPreview: true,
        defaultQueryTimeoutMs: 60000,
        markOnlineOnConnect: false, // Evita marcar como online automaticamente
        syncFullHistory: false,
        getMessage: async (key) => {
          // Implementar cache de mensagens se necessário
          return { conversation: 'Mensagem não encontrada' };
        }
      };

      // Configurações específicas para pareamento por código
      if (this.authManager.getConnectionMethod() === 'code' && this.authManager.getPhoneNumber()) {
        socketOptions.mobile = false;
        console.log('📱 Modo pareamento por código ativado');
      }

      // Criar socket
      this.sock = makeWASocket(socketOptions);
      
      // Inicializar handler de mensagens
      this.messageHandler = new MessageHandler(this.sock);

      // Configurar listeners
      this.sock.ev.on('creds.update', saveCreds);
      this.setupEventHandlers();

      console.log('🔗 Socket WhatsApp criado com sucesso');

    } catch (err) {
      console.error('❌ Erro ao criar conexão:', err.message);
      
      if (err.message.includes('rate limited')) {
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
      // Limpar sessão corrompida
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
        fs.mkdirSync(this.sessionDir, { recursive: true });
        console.log('🔄 Sessão corrompida removida, criando nova...');
      }
      return await useMultiFileAuthState(this.sessionDir);
    }
  }

  setupEventHandlers() {
    // Handler de atualização de conexão
    this.sock.ev.on('connection.update', async (update) => {
      await this.handleConnectionUpdate(update);
    });

    // Handler de mensagens
    this.sock.ev.on('messages.upsert', async (m) => {
      await this.handleMessages(m);
    });

    // Handler de presença (opcional)
    this.sock.ev.on('presence.update', (presence) => {
      // console.log('👤 Presença atualizada:', presence);
    });

    // Handler de grupos (opcional)
    this.sock.ev.on('groups.upsert', (groups) => {
      // console.log('👥 Novos grupos:', groups);
    });

    // Handler de contatos
    this.sock.ev.on('contacts.upsert', (contacts) => {
      // console.log('📞 Contatos atualizados:', contacts.length);
    });
  }

  async handleConnectionUpdate(update) {
    const { connection, lastDisconnect, qr, isNewLogin, receivedPendingNotifications } = update;
    
    console.log(`🔄 Status da conexão: ${connection || 'conectando...'}`);

    // Exibir QR Code
    if (qr && !this.pairingAttempted) {
      console.log('\n┌────────── ESCANEIE O QR CODE ──────────┐');
      qrcode.generate(qr, { small: true });
      console.log('└────────────────────────────────────────┘\n');
      console.log('📱 Abra o WhatsApp > Dispositivos conectados > Conectar dispositivo');
      this.pairingAttempted = true;
    }

    // Conexão estabelecida
    if (connection === 'open') {
      console.log('✅ Bot conectado com sucesso ao WhatsApp!');
      console.log(`📱 Número: ${this.sock.user?.id}`);
      console.log(`👤 Nome: ${this.sock.user?.name || 'N/A'}`);
      
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      this.pairingAttempted = false;
      
      // Marcar como online após conexão estabelecida
      await this.updatePresence('available');
    }

    // Conexão fechada
    if (connection === 'close') {
      this.isConnected = false;
      await this.handleDisconnection(lastDisconnect);
    }

    // Novo login
    if (isNewLogin) {
      console.log('🔐 Novo login detectado');
    }

    // Notificações pendentes recebidas
    if (receivedPendingNotifications) {
      console.log('📬 Notificações pendentes recebidas');
    }
  }

  async handleMessages(m) {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      try {
        // Filtrar mensagens do próprio bot
        if (msg.key.fromMe) continue;
        
        // Filtrar broadcasts e status
        if (isJidBroadcast(msg.key.remoteJid) || isJidStatusBroadcast(msg.key.remoteJid)) {
          continue;
        }

        // Verificar se a mensagem tem conteúdo
        if (!msg.message) continue;

        // Log da mensagem recebida
        const from = msg.key.remoteJid;
        const isGroup = from.endsWith('@g.us');
        console.log(`📨 Nova mensagem de ${isGroup ? 'grupo' : 'contato'}: ${from}`);

        // Processar mensagem
        if (this.messageHandler) {
          await this.messageHandler.handleMessage(msg);
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

    console.log('🔌 Conexão perdida. Código:', reason);

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

      default:
        console.log('❓ Desconexão por motivo desconhecido:', reason);
        shouldReconnect = true;
    }

    if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
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
          this.cleanup();
          process.exit(1);
        }
      }
    } else if (!shouldReconnect) {
      console.log('🛑 Encerrando bot...');
      this.cleanup();
      process.exit(0);
    } else {
      console.log('❌ Máximo de tentativas de reconexão atingido');
      this.cleanup();
      process.exit(1);
    }
  }

  async clearSession() {
    try {
      if (fs.existsSync(this.sessionDir)) {
        fs.rmSync(this.sessionDir, { recursive: true, force: true });
        console.log('🗑️ Sessão limpa');
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
      await this.stop();
    };

    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGUSR2', gracefulShutdown); // nodemon

    process.on('uncaughtException', (err) => {
      console.error('❌ Exceção não capturada:', err);
      this.cleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('❌ Promise rejeitada não tratada:', reason);
      console.error('Promise:', promise);
    });
  }

  cleanup() {
    console.log('🧹 Limpando recursos...');
    
    if (this.inputManager) {
      this.inputManager.closeInterface();
    }

    if (this.sock) {
      try {
        this.sock.ev.removeAllListeners();
      } catch (err) {
        console.error('❌ Erro ao remover listeners:', err);
      }
    }
  }

  async stop() {
    console.log('🛑 Parando bot...');
    
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
      this.cleanup();
      console.log('✅ Bot parado com sucesso');
      process.exit(0);
    }
  }

  // Utilitário para delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Método para enviar mensagem (utilitário)
  async sendMessage(jid, content, options = {}) {
    try {
      if (!this.isConnected) {
        throw new Error('Bot não está conectado');
      }
      
      return await this.sock.sendMessage(jid, content, options);
    } catch (err) {
      console.error('❌ Erro ao enviar mensagem:', err);
      throw err;
    }
  }

  // Getters para status
  get connected() {
    return this.isConnected;
  }

  get user() {
    return this.sock?.user || null;
  }
}

// Inicialização
const bot = new WhatsAppBot();

// Iniciar bot
bot.start().catch((err) => {
  console.error('❌ Erro fatal na inicialização:', err);
  process.exit(1);
});

module.exports = WhatsAppBot;
