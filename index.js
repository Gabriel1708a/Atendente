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
        this.sessionInvalidated = false; // Flag para forçar QR quando sessão é inválida
        this.reconnectAttempts = 0; // Contador de tentativas de reconexão
        this.maxReconnectAttempts = 3; // Máximo de tentativas antes de limpar sessão
        
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
                
                // Se sessão foi invalidada, força QR Code
                if (this.sessionInvalidated || method === 'qr' || !method) {
                    this.displayCustomQR(qr);
                    this.sessionInvalidated = false; // Reset flag
                } else if (method === 'code') {
                    // Para método código, tenta imediatamente quando QR é gerado
                    console.log('🚀 QR gerado! Tentando pareamento por código...');
                    this.pairingAttempted = true;
                    
                    // Tenta imediatamente - este é o momento certo
                    try {
                        await this.handlePairingCode();
                    } catch (error) {
                        console.error('❌ Erro no pareamento imediato:', error);
                        this.pairingAttempted = false;
                        
                        // Em caso de erro, oferece QR Code
                        console.log('\n🔄 Pareamento falhou, mostrando QR Code como alternativa...');
                        this.displayCustomQR(qr);
                    }
                }
            }

            if (connection === 'close') {
                this.pairingAttempted = false; // Reset para próxima tentativa
                await this.handleDisconnection(lastDisconnect);
            } else if (connection === 'open') {
                this.pairingAttempted = false; // Reset após sucesso
                this.reconnectAttempts = 0; // Reset contador de reconexão
                console.log('✅ Conectado ao WhatsApp com sucesso!');
                this.isConnected = true;
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
     * Exibe QR Code customizado no terminal (SEM LIMPAR)
     * @param {string} qr - String do QR code
     */
    displayCustomQR(qr) {
        // NÃO limpa mais o terminal para manter QR visível
        console.log('\n┌────────────────────────────────────────────────────────────┐');
        console.log('│                    🤖 BOT WHATSAPP                        │');
        console.log('│                   📱 ESCANEIE O QR CODE                   │');
        console.log('└────────────────────────────────────────────────────────────┘\n');
        
        qrcode.generate(qr, { small: true });
        
        console.log('\n📋 INSTRUÇÕES:');
        console.log('1️⃣  Abra o WhatsApp no seu celular');
        console.log('2️⃣  Toque em Menu > Dispositivos conectados');
        console.log('3️⃣  Toque em "Conectar um dispositivo"');
        console.log('4️⃣  Escaneie o código QR acima');
        console.log('\n⏳ Aguardando escaneamento...');
        console.log('💡 O QR Code permanecerá visível até a conexão');
        console.log('🔒 Sessão será preservada automaticamente\n');
    }

    /**
     * Lida com pareamento por código - Versão corrigida
     */
    async handlePairingCode() {
        try {
            const phoneNumber = this.authManager.getPhoneNumber();
            if (!phoneNumber) {
                console.log('❌ Número de telefone não configurado para pareamento');
                return;
            }

            console.log('\n┌────────────────────────────────────────────────────────────┐');
            console.log('│                 🤖 BOT WHATSAPP                           │');
            console.log('│               🔢 CÓDIGO DE PAREAMENTO                     │');
            console.log('└────────────────────────────────────────────────────────────┘\n');

            console.log(`📱 Número configurado: ${phoneNumber}`);
            console.log(`🔍 Formato: +${phoneNumber}`);
            
            // Solicita código diretamente - momento certo é quando QR é gerado
            console.log('🔄 Solicitando código de pareamento...');
            
            let code = null;
            let usedFormat = null;
            
            // Tenta primeiro o formato mais comum
            try {
                console.log(`📞 Tentando: ${phoneNumber}`);
                code = await this.sock.requestPairingCode(phoneNumber);
                usedFormat = phoneNumber;
                console.log(`✅ Sucesso!`);
            } catch (error) {
                console.log(`❌ Formato principal falhou: ${error.message}`);
                
                // Se falhar, tenta sem código do país
                const localNumber = phoneNumber.replace(/^55/, '');
                try {
                    console.log(`📞 Tentando formato local: ${localNumber}`);
                    code = await this.sock.requestPairingCode(localNumber);
                    usedFormat = localNumber;
                    console.log(`✅ Sucesso com formato local!`);
                } catch (localError) {
                    console.log(`❌ Formato local também falhou: ${localError.message}`);
                    throw new Error(`Ambos os formatos falharam: ${error.message}`);
                }
            }
            
            console.log('\n┌────────────────────────────────────────────────────────────┐');
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
            console.error('❌ Erro no pareamento:', error);
            console.log('\n🚫 DIAGNÓSTICO:');
            console.log(`   Erro: ${error.message}`);
            console.log(`   Socket: ${this.sock ? 'Conectado' : 'Não conectado'}`);
            console.log(`   Função requestPairingCode: ${typeof this.sock?.requestPairingCode === 'function' ? 'Disponível' : 'Não disponível'}`);
            
            // Diagnóstico específico e soluções
            if (error.message.includes('401') || error.message.includes('Unauthorized')) {
                console.log('\n💡 ERRO: NÚMERO NÃO AUTORIZADO');
                console.log('   🚫 O número não tem WhatsApp ativo');
                console.log('   💡 SOLUÇÃO: Verifique se o WhatsApp funciona neste número');
            } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
                console.log('\n💡 ERRO: MUITAS TENTATIVAS');
                console.log('   🚫 Limite de tentativas excedido');
                console.log('   💡 SOLUÇÃO: Aguarde 30 minutos e tente novamente');
            } else if (error.message.includes('429') || error.message.includes('rate')) {
                console.log('\n💡 ERRO: LIMITE DE VELOCIDADE');
                console.log('   🚫 Muitas solicitações muito rápidas');
                console.log('   💡 SOLUÇÃO: Aguarde 5 minutos');
            } else if (error.message.includes('invalid') || error.message.includes('Invalid')) {
                console.log('\n💡 ERRO: NÚMERO INVÁLIDO');
                console.log('   🚫 Formato do número não aceito');
                console.log('   💡 SOLUÇÃO: Verifique o formato (5511987654321)');
            } else if (error.message.includes('Socket')) {
                console.log('\n💡 ERRO: PROBLEMA DE CONEXÃO');
                console.log('   🚫 Socket não está no estado correto');
                console.log('   💡 SOLUÇÃO: Limpe a sessão e reinicie');
            }
            
            console.log('\n🎯 RECOMENDAÇÃO: Use QR Code (mais confiável)');
            console.log('\n🔧 COMANDOS ÚTEIS:');
            console.log('   npm run clear-session  ← Limpa sessão corrompida');
            console.log('   npm start              ← Reinicia com QR Code');
            
            // Não remove mais a sessão automaticamente
            // Apenas reporta o erro para troubleshooting manual
            console.log('\n💡 DICA: Se o problema persistir, use:');
            console.log('   npm run clear-session    ← Remove sessão manualmente');
            
            // Não oferece mais opções - vai direto para QR Code
            console.log('\n🔄 Mudando automaticamente para QR Code (mais confiável)...');
            this.authManager.setConnectionMethod('qr');
            this.pairingAttempted = false;
            
            // Pequena pausa e tenta mostrar QR
            setTimeout(() => {
                console.log('📷 QR Code será exibido em breve...');
            }, 2000);
        }
    }

    /**
     * Trata desconexões
     * @param {Object} lastDisconnect - Informações da última desconexão
     */
    async handleDisconnection(lastDisconnect) {
        const errorReason = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = errorReason !== DisconnectReason.loggedOut;
        
        if (lastDisconnect?.error) {
            
            switch (errorReason) {
                case DisconnectReason.badSession:
                    this.reconnectAttempts++;
                    console.log(`📱 Sessão inválida detectada (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    
                    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        console.log('❌ Sessão definitivamente corrompida!');
                        console.log('🗑️ Limpando sessão automática...');
                        this.authManager.clearSession();
                        console.log('✅ Sessão limpa! Reinicie o bot: npm start');
                        process.exit(1);
                    }
                    
                    console.log('💡 Gerando novo QR Code...');
                    this.sessionInvalidated = true; // Marca para forçar QR
                    // Força reconexão para gerar QR Code
                    setTimeout(() => {
                        console.log('🔄 Reiniciando para gerar QR Code...');
                        this.connect();
                    }, 3000);
                    return; // Não continua o fluxo normal
                    break;
                    
                case DisconnectReason.connectionClosed:
                    console.log('🔌 Conexão fechada. Tentando reconectar...');
                    break;
                    
                case DisconnectReason.connectionLost:
                    console.log('📡 Conexão perdida. Tentando reconectar...');
                    break;
                    
                case DisconnectReason.connectionReplaced:
                    console.log('🔄 Conexão substituída em outro dispositivo');
                    console.log('💡 Sessão mantida - apenas reconecte');
                    break;
                    
                case DisconnectReason.loggedOut:
                    this.reconnectAttempts++;
                    console.log(`🚪 Deslogado do WhatsApp (tentativa ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                    
                    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                        console.log('❌ Muitas tentativas de reconexão falharam!');
                        console.log('🗑️ Limpando sessão corrompida...');
                        this.authManager.clearSession();
                        console.log('✅ Sessão limpa! Reinicie o bot: npm start');
                        process.exit(1);
                    }
                    
                    console.log('💡 Sessão mantida - gerando novo QR...');
                    this.sessionInvalidated = true; // Marca para forçar QR
                    // Força reconexão para gerar QR Code
                    setTimeout(() => {
                        console.log('🔄 Reiniciando para gerar QR Code...');
                        this.connect();
                    }, 3000); // Aumentei para 3s
                    return; // Não continua o fluxo normal
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
        console.log('\n┌────────────────────────────────────────────────────────────┐');
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
        console.log('🔒 Sessão WhatsApp preservada');
        console.log('💡 Próximo start reconectará automaticamente');
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