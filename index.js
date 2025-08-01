const makeWASocket = require('@whiskeysockets/baileys').default;
const { DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const P = require('pino');

// Importar módulos personalizados
const MessageHandler = require('./handlers/messageHandler');
const AuthManager = require('./session/auth');
const InputManager = require('./utils/inputManager');

/**
 * Bot de Atendimento WhatsApp - Arquivo Principal
 * Desenvolvido com Baileys Library
 */
class WhatsAppBot {
    constructor() {
        this.sock = null;
        this.authManager = new AuthManager();
        this.inputManager = new InputManager();
        this.messageHandler = null;
        this.isConnected = false;
        this.pairingAttempted = false; // Controla tentativas de pareamento
        
        // Logger configurado
        this.logger = P({ level: 'silent' }); // Remove logs internos do Baileys
    }

    /**
     * Inicia o bot
     */
    async start() {
        console.log('🚀 Iniciando Bot de Atendimento WhatsApp...\n');
        
        try {
            // Verifica se já existe sessão
            if (!this.authManager.hasExistingSession()) {
                // Pergunta método de conexão
                const method = await this.inputManager.askConnectionMethod();
                this.authManager.setConnectionMethod(method);
                
                // Se escolheu código, pergunta o número
                if (method === 'code') {
                    const phoneNumber = await this.inputManager.askPhoneNumber();
                    this.authManager.setPhoneNumber(phoneNumber);
                }
                
                // Fecha interface de input
                this.inputManager.closeInterface();
            }
            
            await this.connect();
        } catch (error) {
            console.error('❌ Erro fatal ao iniciar bot:', error);
            this.inputManager.closeInterface();
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
            
            // Configura opções da conexão
            const socketOptions = {
                auth: state,
                logger: this.logger,
                printQRInTerminal: false, // Vamos customizar
                browser: ['Bot Atendimento', 'Chrome', '2.1.0'],
                generateHighQualityLinkPreview: true,
                defaultQueryTimeoutMs: 60_000, // 60 segundos timeout
                markOnlineOnConnect: true
            };

            // Se for método de código e tiver número, adiciona configuração específica
            if (this.authManager.getConnectionMethod() === 'code' && this.authManager.getPhoneNumber()) {
                socketOptions.mobile = false; // Força modo web
                socketOptions.syncFullHistory = false; // Não sincroniza histórico completo
                console.log('🔧 Configurando conexão para pareamento por código...');
            }

            // Cria conexão
            this.sock = makeWASocket(socketOptions);

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
            const { connection, lastDisconnect, qr, isNewLogin } = update;

            console.log(`🔄 Update de conexão: ${connection || 'connecting'}`);
            
            // Diferentes estratégias baseadas no método
            const method = this.authManager.getConnectionMethod();
            
            if (connection === 'connecting') {
                console.log('📡 Conectando ao WhatsApp...');
            }
            
            // Exibe QR Code customizado ou solicita pareamento
            if (qr && !this.pairingAttempted) {
                console.log(`🔍 Método configurado: ${method}`);
                
                if (method === 'qr' || !method) {
                    this.displayCustomQR(qr);
                } else if (method === 'code') {
                    // Para método código, aguarda um pouco mais antes de tentar
                    console.log('⏳ Preparando pareamento por código...');
                    this.pairingAttempted = true;
                    
                    // Aguarda socket estar mais estável
                    setTimeout(async () => {
                        try {
                            await this.handlePairingCode();
                        } catch (error) {
                            console.error('❌ Erro no timing do pareamento:', error);
                            this.pairingAttempted = false;
                        }
                    }, 3000); // 3 segundos de delay
                }
            }

            if (connection === 'close') {
                this.pairingAttempted = false; // Reset para próxima tentativa
                await this.handleDisconnection(lastDisconnect);
            } else if (connection === 'open') {
                this.pairingAttempted = false; // Reset após sucesso
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
     * Lida com pareamento por código - Versão melhorada
     */
    async handlePairingCode() {
        try {
            const phoneNumber = this.authManager.getPhoneNumber();
            if (!phoneNumber) {
                console.log('❌ Número de telefone não configurado para pareamento');
                return;
            }

            console.clear();
            console.log('┌────────────────────────────────────────────────────────────┐');
            console.log('│                 🤖 BOT WHATSAPP                           │');
            console.log('│               🔢 CÓDIGO DE PAREAMENTO                     │');
            console.log('└────────────────────────────────────────────────────────────┘\n');

            console.log(`📱 Número configurado: ${phoneNumber}`);
            console.log(`🔍 Formato: +${phoneNumber}`);
            console.log('⏳ Aguardando socket estar pronto...\n');
            
            // Aguarda socket estar pronto e estável
            let attempts = 0;
            const maxAttempts = 10;
            
            while (!this.sock?.user && attempts < maxAttempts) {
                console.log(`🔄 Tentativa ${attempts + 1}/${maxAttempts} - Aguardando socket...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                attempts++;
            }
            
            if (attempts >= maxAttempts) {
                throw new Error('Socket não ficou pronto para pareamento');
            }
            
            console.log('✅ Socket pronto! Solicitando código...');
            
            // Formata número para diferentes tentativas
            const phoneFormats = [
                phoneNumber,                    // 5511987654321
                phoneNumber.replace(/^55/, ''), // 11987654321
                `+${phoneNumber}`,              // +5511987654321
            ];
            
            let code = null;
            let usedFormat = null;
            
            for (const format of phoneFormats) {
                try {
                    console.log(`🔄 Tentando formato: ${format}`);
                    code = await this.sock.requestPairingCode(format);
                    usedFormat = format;
                    console.log(`✅ Sucesso com formato: ${format}`);
                    break;
                } catch (formatError) {
                    console.log(`❌ Formato ${format} falhou: ${formatError.message}`);
                    if (formatError.message.includes('rate')) {
                        console.log('⏰ Rate limit detectado, aguardando...');
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    }
                }
            }
            
            if (!code) {
                throw new Error('Nenhum formato de número funcionou');
            }
            
            console.clear();
            console.log('┌────────────────────────────────────────────────────────────┐');
            console.log('│                 ✅ CÓDIGO GERADO COM SUCESSO              │');
            console.log('└────────────────────────────────────────────────────────────┘\n');
            
            console.log(`🔑 CÓDIGO DE PAREAMENTO: ${code.toUpperCase()}`);
            console.log(`📱 Número usado: ${usedFormat}`);
            console.log(`🕐 Gerado em: ${new Date().toLocaleTimeString()}`);
            console.log('\n📋 INSTRUÇÕES DETALHADAS:');
            console.log('1️⃣  Abra o WhatsApp no celular');
            console.log('2️⃣  Toque nos 3 pontos (⋮) no canto superior direito');
            console.log('3️⃣  Selecione "Dispositivos conectados"');
            console.log('4️⃣  Toque em "Conectar um dispositivo"');
            console.log('5️⃣  Toque em "Conectar com código de telefone"');
            console.log(`6️⃣  Digite o código: ${code.toUpperCase()}`);
            console.log('\n⚠️  IMPORTANTE:');
            console.log('• O código expira em 60 segundos');
            console.log('• Digite EXATAMENTE como mostrado');
            console.log('• Não feche este terminal');
            console.log('\n🔄 Aguardando confirmação do WhatsApp...\n');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        } catch (error) {
            console.error('❌ Erro crítico no pareamento:', error);
            console.log('\n🚫 DIAGNÓSTICO COMPLETO:');
            console.log(`   Erro: ${error.message}`);
            console.log(`   Socket: ${this.sock ? 'OK' : 'NULL'}`);
            console.log(`   Usuário: ${this.sock?.user ? 'OK' : 'NULL'}`);
            
            // Diagnóstico específico
            if (error.message.includes('401')) {
                console.log('\n💡 ERRO 401 - NÃO AUTORIZADO:');
                console.log('   • Número não tem WhatsApp instalado');
                console.log('   • Número foi banido do WhatsApp');
                console.log('   • Número é inválido para pareamento');
            } else if (error.message.includes('403')) {
                console.log('\n💡 ERRO 403 - PROIBIDO:');
                console.log('   • Muitas tentativas de pareamento');
                console.log('   • Número bloqueado temporariamente');
                console.log('   • Aguarde 24 horas antes de tentar novamente');
            } else if (error.message.includes('429')) {
                console.log('\n💡 ERRO 429 - LIMITE EXCEDIDO:');
                console.log('   • Muitas solicitações muito rápidas');
                console.log('   • Aguarde alguns minutos e tente novamente');
            }
            
            console.log('\n🔧 SOLUÇÕES RECOMENDADAS:');
            console.log('1. Limpar sessão (delete pasta session/baileys_auth_info)');
            console.log('2. Aguardar 30 minutos antes de tentar novamente');
            console.log('3. Usar QR Code como alternativa');
            console.log('4. Verificar se o número tem WhatsApp ativo');
            
            // Reset automático de sessão em alguns casos
            if (error.message.includes('401') || error.message.includes('invalid')) {
                console.log('\n🔄 Executando reset automático de sessão...');
                this.authManager.clearSession();
            }
            
            // Opção para usuário
            this.inputManager.createInterface();
            console.log('\n❓ OPÇÕES:');
            console.log('1 - Tentar novamente com outro número');
            console.log('2 - Usar QR Code');
            console.log('3 - Sair e tentar mais tarde');
            
            const choice = await this.inputManager.question('Digite sua escolha (1/2/3): ');
            this.inputManager.closeInterface();
            
            switch(choice) {
                case '1':
                    // Permite inserir novo número
                    console.log('\n🔄 Vamos tentar com outro número...');
                    const newNumber = await this.inputManager.askPhoneNumber();
                    this.authManager.setPhoneNumber(newNumber);
                    setTimeout(() => this.handlePairingCode(), 3000);
                    break;
                case '2':
                    console.log('🔄 Mudando para método QR Code...\n');
                    this.authManager.setConnectionMethod('qr');
                    // Força regeneração do QR
                    this.pairingAttempted = false;
                    break;
                case '3':
                default:
                    console.log('👋 Saindo... Tente novamente mais tarde.');
                    process.exit(0);
            }
        }
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
        
        // Mostra método de conexão usado
        const method = this.authManager.getConnectionMethod();
        if (method === 'code') {
            console.log('🔑 Método: Código de Pareamento');
        } else if (method === 'qr') {
            console.log('📷 Método: QR Code');
        } else {
            console.log('🔄 Método: Sessão Existente (reconectado automaticamente)');
        }
        
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
        console.log('\n🔐 MÉTODOS DE CONEXÃO:');
        console.log('• QR Code - Método tradicional');
        console.log('• Código de Pareamento - Mais prático (novo!)');
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

        this.isConnected = true;
    }

    /**
     * Para o bot graciosamente
     */
    async stop() {
        console.log('🛑 Parando bot...');
        
        // Fecha interface de input se aberta
        this.inputManager.closeInterface();
        
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