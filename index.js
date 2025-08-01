const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');

// Importar módulos personalizados
const MessageHandler = require('./handlers/messageHandler');
const AuthManager = require('./session/auth');

/**
 * Bot de Atendimento WhatsApp - Arquivo Principal
 * Desenvolvido com Baileys Library
 */
class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.authManager = new AuthManager();
        this.messageHandler = null;
        this.isConnected = false;
        
        // Logger configurado
        this.logger = P({ level: 'silent' }); // Remove logs internos do Baileys
    }

    /**
     * Inicia o bot
     */
    async start() {
        console.log('🚀 Iniciando Bot de Atendimento WhatsApp...\n');
        
        try {
            await this.connect();
        } catch (error) {
            console.error('❌ Erro fatal ao iniciar bot:', error);
            process.exit(1);
        }
    }

    /**
     * Conecta ao WhatsApp
     */
    async connect() {
        try {
            // Carrega estado de autenticação
            const { state, saveCreds } = await this.authManager.loadAuthState();
            
            // Cria conexão
            this.sock = makeWASocket({
                auth: state,
                logger: this.logger,
                printQRInTerminal: false, // Vamos customizar o QR
                browser: ['Bot Atendimento', 'Chrome', '1.0.0'],
                generateHighQualityLinkPreview: true
            });

            // Inicializa handler de mensagens
            this.messageHandler = new MessageHandler(this.sock);

            // Configura eventos
            this.setupEventHandlers(saveCreds);

        } catch (error) {
            console.error('❌ Erro ao conectar:', error);
            throw error;
        }
    }

    /**
     * Configura os event handlers do socket
     * @param {Function} saveCreds - Função para salvar credenciais
     */
    setupEventHandlers(saveCreds) {
        // Evento de atualização de credenciais
        this.sock.ev.on('creds.update', saveCreds);

        // Evento de atualização de conexão
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            // Exibe QR Code customizado
            if (qr) {
                this.displayCustomQR(qr);
            }

            if (connection === 'close') {
                await this.handleDisconnection(lastDisconnect);
            } else if (connection === 'open') {
                this.handleSuccessfulConnection();
            }
        });

        // Evento de novas mensagens
        this.sock.ev.on('messages.upsert', async (m) => {
            if (m.type === 'notify') {
                for (const message of m.messages) {
                    if (!message.key.fromMe && message.message) {
                        await this.messageHandler.handleMessage(message);
                    }
                }
            }
        });
    }

    /**
     * Exibe QR Code customizado no terminal
     * @param {string} qr - String do QR code
     */
    displayCustomQR(qr) {
        console.clear();
        console.log('┌────────────────────────────────────────────────────────────┐');
        console.log('│                    🤖 BOT WHATSAPP                        │');
        console.log('│                   📱 ESCANEIE O QR CODE                   │');
        console.log('└────────────────────────────────────────────────────────────┘\n');
        
        qrcode.generate(qr, { small: true });
        
        console.log('\n📋 INSTRUÇÕES:');
        console.log('1️⃣  Abra o WhatsApp no seu celular');
        console.log('2️⃣  Toque em Menu > Dispositivos conectados');
        console.log('3️⃣  Toque em "Conectar um dispositivo"');
        console.log('4️⃣  Escaneie o código QR acima');
        console.log('\n⏳ Aguardando escaneamento...\n');
    }

    /**
     * Trata desconexões
     * @param {Object} lastDisconnect - Informações da última desconexão
     */
    async handleDisconnection(lastDisconnect) {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
        
        if (lastDisconnect?.error) {
            const errorReason = lastDisconnect.error.output?.statusCode;
            
            switch (errorReason) {
                case DisconnectReason.badSession:
                    console.log('📱 Sessão inválida detectada. Reiniciando...');
                    this.authManager.clearSession();
                    break;
                    
                case DisconnectReason.connectionClosed:
                    console.log('🔌 Conexão fechada. Tentando reconectar...');
                    break;
                    
                case DisconnectReason.connectionLost:
                    console.log('📡 Conexão perdida. Tentando reconectar...');
                    break;
                    
                case DisconnectReason.connectionReplaced:
                    console.log('🔄 Conexão substituída em outro dispositivo');
                    break;
                    
                case DisconnectReason.loggedOut:
                    console.log('🚪 Deslogado do WhatsApp. QR Code será necessário');
                    this.authManager.clearSession();
                    break;
                    
                case DisconnectReason.restartRequired:
                    console.log('🔄 Reinicialização necessária...');
                    break;
                    
                case DisconnectReason.timedOut:
                    console.log('⏰ Timeout na conexão. Tentando reconectar...');
                    break;
                    
                default:
                    console.log(`❓ Desconexão: ${errorReason || 'Motivo desconhecido'}`);
            }
        }

        if (shouldReconnect) {
            console.log('🔄 Reconectando em 5 segundos...\n');
            setTimeout(() => this.connect(), 5000);
        } else {
            console.log('❌ Bot desconectado permanentemente');
            process.exit();
        }
    }

    /**
     * Trata conexão bem-sucedida
     */
    handleSuccessfulConnection() {
        console.clear();
        console.log('┌────────────────────────────────────────────────────────────┐');
        console.log('│                    ✅ BOT CONECTADO!                       │');
        console.log('└────────────────────────────────────────────────────────────┘\n');
        
        console.log('🎉 Bot WhatsApp conectado com sucesso!');
        console.log('📱 Número conectado:', this.sock.user?.id?.split(':')[0]);
        console.log('👤 Nome:', this.sock.user?.name || 'Não definido');
        console.log('\n🤖 Bot está ativo e aguardando mensagens...');
        console.log('💡 Digite "oi" ou "menu" em qualquer conversa para testar!\n');
        
        console.log('📋 COMANDOS DISPONÍVEIS:');
        console.log('• "oi" ou "menu" - Exibe menu interativo');
        console.log('• Botões: "Suporte 🌐" e "Informações Bot 🤖"');
        console.log('• !uparvideo - Adiciona vídeos ao bot (envie na legenda)');
        console.log('\n🎥 RECURSOS DE VÍDEO:');
        console.log('• Vídeos podem ser adicionados em qualquer seção');
        console.log('• Efeito de digitação realista incluído');
        console.log('• Sistema inteligente de posicionamento');
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        this.isConnected = true;
    }

    /**
     * Para o bot graciosamente
     */
    async stop() {
        console.log('🛑 Parando bot...');
        if (this.sock) {
            await this.sock.logout();
        }
        console.log('✅ Bot parado com sucesso!');
        process.exit(0);
    }
}

// Inicialização do bot
const bot = new WhatsAppBot();

// Tratamento de sinais do sistema
process.on('SIGINT', async () => {
    console.log('\n🛑 Recebido sinal de parada...');
    await bot.stop();
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Recebido sinal de término...');
    await bot.stop();
});

// Inicia o bot
bot.start().catch(console.error);