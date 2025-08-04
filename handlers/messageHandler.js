const VideoHandler = require('./videoHandler');

/**
 * Handler para processar mensagens recebidas 
 */
class MessageHandler {
    constructor(sock) {
        this.sock = sock;
        this.videoHandler = new VideoHandler(sock);
    }

    /**
     * Processa mensagens recebidas
     * @param {Object} m - Objeto da mensagem
     */
    async handleMessage(m) {
        try {
            const messageType = Object.keys(m.message)[0];
            const userNumber = m.key.remoteJid;
            
            console.log(`📥 Tipo de mensagem recebida: ${messageType} de ${userNumber}`);
            
            // Verifica se é comando !uparvideo em vídeo
            if (messageType === 'videoMessage') {
                const caption = m.message.videoMessage?.caption || '';
                if (caption.toLowerCase().includes('!uparvideo')) {
                    await this.videoHandler.handleVideoUpload(m, userNumber);
                    return;
                }
            }
            
            // Verifica se é resposta de botão interativo
            if (messageType === 'buttonsResponseMessage') {
                console.log(`🔘 Resposta de botão detectada de ${userNumber}`);
                await this.handleButtonMessage(m);
                return;
            }
            
            // Verifica se é resposta de Interactive Message MODERNA
            if (messageType === 'interactiveResponseMessage') {
                console.log(`⚡ Interactive Response MODERNO detectado de ${userNumber}`);
                await this.handleModernInteractiveMessage(m);
                return;
            }
            
            // Verifica se é resposta de lista interativa
            if (messageType === 'listResponseMessage') {
                console.log(`📋 Resposta de lista detectada de ${userNumber}`);
                await this.handleListMessage(m);
                return;
            }
            
            // Verifica se é uma mensagem de texto
            if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
                const messageText = m.message.conversation || m.message.extendedTextMessage?.text || '';
                
                console.log(`📩 Mensagem recebida de ${userNumber}: ${messageText}`);
                
                // Verifica se usuário está aguardando escolha de vídeo
                if (this.videoHandler.isAwaitingVideoPlacement(userNumber)) {
                    const userData = this.videoHandler.awaitingVideoPlacement.get(userNumber);
                    
                    // Se está aguardando nome de seção personalizada
                    if (userData && userData.step === 'custom_name') {
                        await this.videoHandler.handleCustomSectionName(userNumber, messageText);
                        return;
                    }
                    
                    // Senão, processa escolha de local
                    await this.videoHandler.handleVideoPlacement(userNumber, messageText.trim());
                    return;
                }

                // Verifica estados de gerenciamento
                const userState = this.videoHandler.getUserState(userNumber);
                if (userState) {
                    await this.handleUserStateMessage(userNumber, messageText, userState);
                    return;
                }
                
                // Verifica se é comando de ativação
                if (this.isActivationCommand(messageText)) {
                    await this.sendWelcomeMenu(userNumber);
                    return;
                }

                // Comandos do sistema de gerenciamento
                if (messageText.toLowerCase().trim() === '!criar') {
                    await this.handleCreateStep(userNumber);
                    return;
                }

                if (messageText.toLowerCase().startsWith('!editar')) {
                    await this.handleEditStep(userNumber, messageText);
                    return;
                }

                if (messageText.toLowerCase().startsWith('!excluir')) {
                    await this.handleDeleteStep(userNumber, messageText);
                    return;
                }

                if (messageText.toLowerCase().startsWith('!legenda')) {
                    await this.handleEditCaption(userNumber, messageText);
                    return;
                }

                if (messageText.toLowerCase().trim() === '!listar') {
                    await this.handleListSteps(userNumber);
                    return;
                }

                // Verifica se é comando !gerenciar
                if (messageText.toLowerCase().trim() === '!gerenciar') {
                    await this.sendStepManagementMenu(userNumber);
                    return;
                }

                // Comando especial para testar botões
                if (messageText.toLowerCase().trim() === '!testbotoes') {
                    await this.testButtonFormats(userNumber);
                    return;
                }

                // Comando para testar formatos modernos
                if (messageText.toLowerCase().trim() === '!testmoderno') {
                    await this.testModernFormats(userNumber);
                    return;
                }
                
                // Verifica se é resposta numérica (1, 2, etc.)
                if (this.isNumericResponse(messageText)) {
                    await this.handleNumericResponse(userNumber, messageText.trim());
                    return;
                }
            }
            
        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
        }
    }

    /**
     * Verifica se é comando de ativação
     * @param {string} text - Texto da mensagem
     * @returns {boolean}
     */
    isActivationCommand(text) {
        const activationCommands = ['oi', 'olá', 'menu', 'inicio', 'start'];
        return activationCommands.includes(text.toLowerCase().trim());
    }

    /**
     * Verifica se é uma resposta numérica (1, 2, 3, 4, 5)
     * @param {string} text - Texto da mensagem
     * @returns {boolean}
     */
    isNumericResponse(text) {
        const numericResponses = ['1', '2', '3', '4', '5'];
        return numericResponses.includes(text.trim());
    }

    /**
     * Simula efeito de digitação realista
     * @param {string} userNumber - Número do usuário
     * @param {number} duration - Duração em milissegundos
     */
    async sendTypingEffect(userNumber, duration = 2000) {
        try {
            await this.sock.sendPresenceUpdate('composing', userNumber);
            await new Promise(resolve => setTimeout(resolve, duration));
            await this.sock.sendPresenceUpdate('available', userNumber);
        } catch (error) {
            // Falha silenciosa se não conseguir enviar presença
        }
    }

    /**
     * Envia menu de boas-vindas dinâmico
     * @param {string} userNumber - Número do usuário
     */
    async sendWelcomeMenu(userNumber) {
        try {
            // Efeito de digitação
            await this.sendTypingEffect(userNumber, 1800);
            
            // Envia vídeo de boas-vindas se disponível
            await this.sendVideoIfAvailable(userNumber, 'welcome');
            
            // Menu dinâmico baseado nas etapas disponíveis
            await this.sendFallbackMenu(userNumber);

        } catch (error) {
            console.error('❌ Erro ao enviar menu de boas-vindas:', error);
        }
    }

    /**
     * Envia menu fallback com emojis numerados (DINÂMICO baseado no usuário)
     * @param {string} userNumber - Número do usuário
     */
    async sendFallbackMenu(userNumber) {
        try {
            // Efeito de digitação antes do menu
            await this.sendTypingEffect(userNumber, 1800);
            
            // Obtém etapas disponíveis para este usuário
            const availableSteps = this.videoHandler.getAvailableStepsForUser(userNumber);
            const conditionalSteps = this.videoHandler.videoConfig.flow?.conditional || {};
            
            let menuOptions = '';
            let optionCount = 1;
            
            // Adiciona opções baseadas nas etapas disponíveis
            for (const stepId of availableSteps) {
                let stepName = '';
                let stepDescription = '';
                
                switch(stepId) {
                    case 'suporte':
                        stepName = 'Suporte 🌐';
                        stepDescription = 'Falar com nosso suporte técnico';
                        break;
                    case 'info_bot':
                        stepName = 'Informações Bot 🤖';
                        stepDescription = 'Conhecer mais sobre este bot';
                        break;
                    default:
                        // Etapa condicional personalizada
                        if (conditionalSteps[stepId]) {
                            stepName = `${conditionalSteps[stepId].name} ✨`;
                            stepDescription = `Opção especial desbloqueada!`;
                        }
                }
                
                if (stepName) {
                    menuOptions += `*${optionCount}️⃣ ${stepName}*\n${stepDescription}\n\n`;
                    optionCount++;
                }
            }
            
            const fallbackMessage = `🎉 *Olá! Bem-vindo ao nosso atendimento!*

Escolha uma das opções digitando o número correspondente:

${menuOptions}_Digite o número para continuar_

---
💡 _Dica: Digite "menu" a qualquer momento para ver as opções novamente_
🎥 _Envie um vídeo com "!uparvideo" para adicionar vídeos ao bot_`;

            await this.sock.sendMessage(userNumber, { text: fallbackMessage });
            console.log(`✅ Menu dinâmico enviado para ${userNumber} (${availableSteps.length} opções)`);

        } catch (error) {
            console.error('❌ Erro ao enviar menu fallback:', error);
        }
    }

    /**
     * Processa resposta numérica do usuário (DINÂMICA)
     * @param {string} userNumber - Número do usuário
     * @param {string} option - Opção selecionada
     */
    async handleNumericResponse(userNumber, option) {
        try {
            // Verifica se é opção do menu Info Bot (1-5)
            if (['1', '2', '3', '4', '5'].includes(option)) {
                // Mapeia opções do Info Bot
                const infoBotOptions = {
                    '1': 'bot_versao',
                    '2': 'bot_recursos', 
                    '3': 'bot_comandos',
                    '4': 'bot_suporte',
                    '5': 'bot_sobre'
                };
                
                const buttonId = infoBotOptions[option];
                if (buttonId) {
                    console.log(`🔢 Info Bot: Usuário ${userNumber} escolheu opção ${option} (${buttonId})`);
                    await this.handleButtonMessage({
                        key: { remoteJid: userNumber },
                        message: {
                            buttonsResponseMessage: {
                                selectedButtonId: buttonId
                            }
                        }
                    });
                    return;
                }
            }
            
            // Lógica original para menu principal
            const availableSteps = this.videoHandler.getAvailableStepsForUser(userNumber);
            const optionIndex = parseInt(option) - 1;
            
            if (optionIndex < 0 || optionIndex >= availableSteps.length) {
                await this.sock.sendMessage(userNumber, {
                    text: `❓ Opção inválida. Digite "menu" para ver as opções disponíveis (1-${availableSteps.length}).`
                });
                return;
            }
            
            const selectedStepId = availableSteps[optionIndex];
            console.log(`🔢 Menu Principal: Usuário ${userNumber} escolheu opção ${option} (${selectedStepId})`);
            
            // Registra que o usuário visitou esta etapa
            this.videoHandler.trackUserNavigation(userNumber, selectedStepId);
            
            await this.handleButtonResponse(userNumber, selectedStepId);

        } catch (error) {
            console.error('❌ Erro ao processar resposta numérica:', error);
        }
    }

    /**
     * Processa resposta de botão tradicional
     * @param {string} userNumber - Número do usuário
     * @param {string} buttonId - ID do botão
     */
    async handleButtonResponse(userNumber, buttonId) {
        try {
            await this.sendTypingEffect(userNumber, 1500);

            let responseMessage = '';

            switch (buttonId) {
                case 'suporte':
                    await this.sendVideoIfAvailable(userNumber, 'suporte');
                    
                    responseMessage = `🌐 *Suporte Técnico*

🔧 **Como podemos ajudar você?**

📞 **Contato direto:**
• Email: suporte@empresa.com  
• Telefone: (11) 9999-9999
• Horário: Segunda a Sexta, 9h às 18h

🆘 **Problemas comuns:**
• Dificuldades de acesso
• Erro em funcionalidades
• Solicitação de recursos
• Feedback e sugestões

💬 **Chat ao vivo:**
Nossa equipe está pronta para atender você!

🔄 _Digite "menu" para voltar ao início_`;
                    break;

                case 'info_bot':
                    // Envia vídeo primeiro se disponível
                    await this.sendVideoIfAvailable(userNumber, 'info_bot');
                    
                    // Envia menu numerado garantido
                    await this.sendBotInfoMenu(userNumber);
                    return; // Não envia mensagem de texto simples
                    break;

                default:
                    // Verifica se é uma etapa condicional
                    const conditionalSteps = this.videoHandler.videoConfig.flow?.conditional || {};
                    if (conditionalSteps[buttonId]) {
                        // Envia vídeo da etapa condicional se disponível
                        const sentConditionalVideo = await this.sendVideoIfAvailable(userNumber, buttonId);
                        if (sentConditionalVideo) {
                            return; // Só envia o vídeo
                        } else {
                            responseMessage = `✨ *${conditionalSteps[buttonId].name}*\n\nℹ️ Esta etapa especial está em configuração.\n\n🔧 Use o comando !gerenciar para adicionar conteúdo.`;
                        }
                    } else {
                        responseMessage = '❓ Opção não reconhecida. Digite "menu" para ver as opções disponíveis.';
                    }
            }

            await this.sock.sendMessage(userNumber, { text: responseMessage });
            console.log(`✅ Resposta enviada para ${userNumber}: ${buttonId}`);

        } catch (error) {
            console.error('❌ Erro ao processar resposta do botão:', error);
        }
    }

    /**
     * Envia menu de informações do bot com BOTÕES REAIS
     * @param {string} userNumber - Número do usuário
     */
    async sendBotInfoMenu(userNumber) {
        try {
            await this.sendTypingEffect(userNumber, 1500);

            // FORMATO MODERNO - Interactive Message (MAIS ATUAL)
            const modernButtonMessage = {
                interactiveMessage: {
                    body: {
                        text: "🤖 *INFORMAÇÕES DO BOT*\n\nSelecione uma das opções:"
                    },
                    footer: {
                        text: "🔧 Bot de Atendimento WhatsApp v2.1"
                    },
                    header: {
                        title: "Menu de Informações",
                        hasMediaAttachment: false
                    },
                    nativeFlowMessage: {
                        buttons: [
                            {
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "🤖 Versão",
                                    id: "bot_versao"
                                })
                            },
                            {
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "⚙️ Recursos", 
                                    id: "bot_recursos"
                                })
                            },
                            {
                                name: "quick_reply",
                                buttonParamsJson: JSON.stringify({
                                    display_text: "📜 Comandos",
                                    id: "bot_comandos"
                                })
                            }
                        ]
                    }
                }
            };

            console.log('🚀 Tentando enviar Interactive Message moderno...');
            
            try {
                const result = await this.sock.sendMessage(userNumber, modernButtonMessage);
                console.log('✅ Interactive Message enviado!');
                console.log('📋 Resultado:', JSON.stringify(result, null, 2));
                
                // Verifica se realmente enviou interactive message
                if (result.message && result.message.interactiveMessage) {
                    console.log('🎉 INTERACTIVE MESSAGE FUNCIONOU! interactiveMessage detectado');
                    return; // Sucesso - não precisa fallback
                } else if (result.message && result.message.extendedTextMessage) {
                    console.log('⚠️ Apenas texto enviado, tentando formato legado...');
                    throw new Error('Interactive Message convertido para texto');
                }
                
            } catch (modernError) {
                console.log('❌ Interactive Message falhou, tentando formato legado...');
                
                // FALLBACK 1: Botões tradicionais
                const buttonMessage = {
                    text: `🤖 *INFORMAÇÕES DO BOT*

Selecione uma das opções abaixo:`,
                    footer: '🔧 Bot de Atendimento WhatsApp',
                    buttons: [
                        {
                            buttonId: 'bot_versao',
                            buttonText: { displayText: '🤖 Versão' },
                            type: 1
                        },
                        {
                            buttonId: 'bot_recursos', 
                            buttonText: { displayText: '⚙️ Recursos' },
                            type: 1
                        },
                        {
                            buttonId: 'bot_comandos',
                            buttonText: { displayText: '📜 Comandos' },
                            type: 1
                        }
                    ],
                    headerType: 1
                };

                try {
                    const legacyResult = await this.sock.sendMessage(userNumber, buttonMessage);
                    console.log('✅ Botões legados enviados:', JSON.stringify(legacyResult.message, null, 2));
                    
                    if (legacyResult.message && legacyResult.message.buttonsMessage) {
                        console.log('🎉 BOTÕES LEGADOS FUNCIONARAM!');
                        return;
                    } else {
                        throw new Error('Botões legados convertidos para texto');
                    }
                } catch (legacyError) {
                    console.log('❌ Botões legados falharam, usando Lista Interativa...');
                
                // Lista interativa como alternativa
                const listMessage = {
                    text: `🤖 *INFORMAÇÕES DO BOT*

Selecione uma das opções:`,
                    footer: '🔧 Bot de Atendimento WhatsApp',
                    title: 'Menu de Informações',
                    buttonText: 'Ver Opções',
                    sections: [
                        {
                            title: 'Informações Disponíveis',
                            rows: [
                                {
                                    id: 'bot_versao',
                                    title: '🤖 Versão do Bot',
                                    description: 'Informações de versão e atualizações'
                                },
                                {
                                    id: 'bot_recursos',
                                    title: '⚙️ Recursos',
                                    description: 'Lista completa de funcionalidades'
                                },
                                {
                                    id: 'bot_comandos',
                                    title: '📜 Comandos',
                                    description: 'Guia de todos os comandos'
                                },
                                {
                                    id: 'bot_suporte',
                                    title: '🆘 Suporte Técnico',
                                    description: 'Ajuda e troubleshooting'
                                },
                                {
                                    id: 'bot_sobre',
                                    title: 'ℹ️ Sobre o Sistema',
                                    description: 'Missão e características'
                                }
                            ]
                        }
                    ]
                };
                
                const listResult = await this.sock.sendMessage(userNumber, listMessage);
                console.log('✅ Lista interativa enviada!');
                console.log('📋 Resultado Lista:', JSON.stringify(listResult, null, 2));
                }
            }

        } catch (error) {
            console.error('❌ Erro ao enviar menu Info Bot:', error);
            
            // Fallback final - menu numerado
            const fallbackMessage = `🤖 *INFORMAÇÕES DO BOT*

📋 **Selecione uma opção:**

*1️⃣ Versão do Bot* 
*2️⃣ Recursos*
*3️⃣ Comandos*
*4️⃣ Suporte Técnico* 
*5️⃣ Sobre o Sistema*

💡 _Digite o número da opção (1-5)_`;

            await this.sock.sendMessage(userNumber, { text: fallbackMessage });
            console.log('✅ Fallback numerado enviado');
        }
    }

    /**
     * Processa resposta dos botões interativos
     * @param {Object} message - Mensagem com resposta do botão
     */
    async handleButtonMessage(message) {
        try {
            const userNumber = message.key.remoteJid;
            const buttonResponse = message.message.buttonsResponseMessage;
            const buttonId = buttonResponse.selectedButtonId;

            console.log(`🔘 Botão pressionado: ${buttonId} por ${userNumber}`);

            await this.sendTypingEffect(userNumber, 1500);

            let responseText = '';

            switch(buttonId) {
                case 'bot_versao':
                    responseText = `🤖 *VERSÃO DO BOT*

📦 **Versão Atual:** v2.1.0
📅 **Lançamento:** Janeiro 2025
🔄 **Última Atualização:** Sistema de Etapas Condicionais

✨ **Novidades v2.1:**
• Sistema de etapas condicionais
• Gerenciamento avançado de etapas
• Preservação automática de sessão
• QR Code persistente
• Upload e gerenciamento de vídeos

📈 **Próximas Atualizações:**
• Botões interativos aprimorados
• Sistema de agendamento
• Relatórios de atendimento`;
                    break;

                case 'bot_recursos':
                    responseText = `⚙️ *RECURSOS DO BOT*

🎯 **Funcionalidades Principais:**
• 🎥 Sistema de vídeos integrado
• 🔄 Etapas condicionais dinâmicas
• 🎛️ Gerenciamento de conteúdo
• 📱 Conexão QR Code + Pairing Code
• 🤖 Efeitos de digitação realistas

🛠️ **Comandos Administrativos:**
• !gerenciar - Administrar etapas
• !uparvideo - Upload de vídeos
• !criarcondicional - Etapas condicionais
• !listar - Ver todas as etapas

💡 **Tecnologias:**
• Node.js 18+
• Baileys WhatsApp Library
• Sistema modular escalável`;
                    break;

                case 'bot_comandos':
                    responseText = `📜 *COMANDOS DISPONÍVEIS*

👥 **Comandos do Usuário:**
• "oi" ou "menu" - Menu principal
• Números (1, 2, 3...) - Navegação rápida

🔧 **Comandos Administrativos:**
• !gerenciar - Menu de administração
• !criar - Criar nova etapa
• !editar [número] - Editar etapa
• !excluir [número] - Excluir etapa
• !legenda [número] - Editar legenda
• !listar - Listar todas as etapas

🎥 **Comandos de Vídeo:**
• !uparvideo - Envie com vídeo para upload
• !criarcondicional [id] [requisito] [nome]

💡 **Exemplos:**
• !editar 2
• !legenda 1
• !criarcondicional promocoes suporte Promoções`;
                    break;

                case 'bot_suporte':
                    responseText = `🆘 *SUPORTE TÉCNICO*

📞 **Como Obter Ajuda:**

🔧 **Problemas Comuns:**
• Sessão perdida → npm run clear-session
• Loop de reconexão → Aguardar 3 tentativas
• QR não aparece → Verificar conexão

📚 **Documentação:**
• README.md - Guia completo
• TROUBLESHOOTING.md - Resolução de problemas  
• PHONE_EXAMPLES.md - Formatos de telefone

💬 **Contato:**
Para suporte especializado, entre em contato com o administrador do sistema.

🚀 **Recursos de Auto-Ajuda:**
• Logs detalhados no terminal
• Mensagens de erro explicativas
• Sistema de recuperação automática`;
                    break;

                case 'bot_sobre':
                    responseText = `ℹ️ *SOBRE O SISTEMA*

🎯 **Missão:**
Fornecer atendimento automatizado inteligente e eficiente via WhatsApp.

💡 **Características:**
• Interface conversacional natural
• Sistema de navegação intuitivo
• Conteúdo multimídia (vídeos)
• Fluxos personalizáveis
• Escalabilidade empresarial

🏗️ **Arquitetura:**
• Modular e extensível
• Handlers especializados
• Configuração flexível
• Logs estruturados
• Recuperação de falhas

🔒 **Segurança:**
• Sessões criptografadas
• Validação de entradas
• Proteção contra loops
• Backup automático

⭐ **Diferenciais:**
• Etapas condicionais únicas
• Preservação inteligente de sessão
• Interface administrativa completa`;
                    break;

                default:
                    responseText = '❓ Opção não reconhecida. Tente novamente.';
            }

            await this.sock.sendMessage(userNumber, { text: responseText });

            // Oferece voltar ao menu
            setTimeout(async () => {
                await this.sock.sendMessage(userNumber, {
                    text: '🔄 _Digite "menu" para voltar ao menu principal_'
                });
            }, 2000);

        } catch (error) {
            console.error('❌ Erro ao processar resposta do botão:', error);
        }
    }

    /**
     * Processa resposta das listas interativas
     * @param {Object} message - Mensagem com resposta da lista
     */
    async handleListMessage(message) {
        try {
            const userNumber = message.key.remoteJid;
            const listResponse = message.message.listResponseMessage;
            const selectedId = listResponse.singleSelectReply.selectedRowId;

            console.log(`📋 Lista selecionada: ${selectedId} por ${userNumber}`);

            // Usa a mesma lógica dos botões
            await this.handleButtonMessage({
                key: message.key,
                message: {
                    buttonsResponseMessage: {
                        selectedButtonId: selectedId
                    }
                }
            });

        } catch (error) {
            console.error('❌ Erro ao processar resposta da lista:', error);
        }
    }

    /**
     * Envia vídeo se disponível para a seção
     * @param {string} userNumber - Número do usuário
     * @param {string} section - Seção (welcome, suporte, info_bot)
     * @returns {boolean} - True se vídeo foi enviado
     */
    async sendVideoIfAvailable(userNumber, section) {
        try {
            if (this.videoHandler.hasVideoForSection(section)) {
                const videoPath = this.videoHandler.getVideoForSection(section);
                const customCaption = this.videoHandler.videoConfig.captions?.[section] || `🎥 Vídeo de ${section}`;
                
                await this.sock.sendMessage(userNumber, {
                    video: { url: videoPath },
                    caption: customCaption
                });
                
                console.log(`🎥 Vídeo ${section} enviado para ${userNumber}`);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`❌ Erro ao enviar vídeo ${section}:`, error);
            return false;
        }
    }

    // Métodos de gerenciamento simplificados - implementações básicas
    async sendStepManagementMenu(userNumber) {
        const message = `🎛️ *GERENCIAMENTO DE ETAPAS*

📋 **Comandos disponíveis:**
• !criar - Criar nova etapa
• !listar - Ver todas etapas
• !editar [número] - Editar etapa
• !legenda [número] - Editar legenda
• !excluir [número] - Excluir etapa`;

        await this.sock.sendMessage(userNumber, { text: message });
    }

    async handleCreateStep(userNumber) {
        await this.sock.sendMessage(userNumber, { 
            text: '🚧 Sistema de criação em desenvolvimento. Use !criarcondicional para etapas condicionais.' 
        });
    }

    async handleEditStep(userNumber, messageText) {
        await this.sock.sendMessage(userNumber, { 
            text: '🚧 Sistema de edição em desenvolvimento.' 
        });
    }

    async handleDeleteStep(userNumber, messageText) {
        await this.sock.sendMessage(userNumber, { 
            text: '🚧 Sistema de exclusão em desenvolvimento.' 
        });
    }

    async handleEditCaption(userNumber, messageText) {
        await this.sock.sendMessage(userNumber, { 
            text: '🚧 Sistema de edição de legenda em desenvolvimento.' 
        });
    }

    async handleListSteps(userNumber) {
        const availableSteps = this.videoHandler.getAvailableStepsForUser(userNumber);
        let message = '📜 **LISTA DE ETAPAS**\n\n';
        
        availableSteps.forEach((step, index) => {
            message += `${index + 1}️⃣ ${step}\n`;
        });
        
        await this.sock.sendMessage(userNumber, { text: message });
    }

    async handleUserStateMessage(userNumber, messageText, userState) {
        // Implementação básica para estados de usuário
        await this.sock.sendMessage(userNumber, { 
            text: 'Estado de usuário processado. Digite "menu" para continuar.' 
        });
        this.videoHandler.clearUserState(userNumber);
    }

    /**
     * Testa diferentes formatos de botões para encontrar o que funciona
     * @param {string} userNumber - Número do usuário
     */
    async testButtonFormats(userNumber) {
        try {
            console.log('🧪 Iniciando teste de formatos de botões...');
            
            // FORMATO 1: Botões simples (padrão)
            const format1 = {
                text: '🧪 *TESTE FORMATO 1 - Botões Simples*',
                footer: 'Teste de Botões',
                buttons: [
                    {
                        buttonId: 'test1',
                        buttonText: { displayText: '✅ Botão 1' },
                        type: 1
                    },
                    {
                        buttonId: 'test2',
                        buttonText: { displayText: '🔥 Botão 2' },
                        type: 1
                    }
                ],
                headerType: 1
            };

            await this.sock.sendMessage(userNumber, { text: '🧪 Testando Formato 1...' });
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
                const result1 = await this.sock.sendMessage(userNumber, format1);
                console.log('✅ Formato 1 enviado:', JSON.stringify(result1.message, null, 2));
                
                if (result1.message.buttonsMessage) {
                    await this.sock.sendMessage(userNumber, { text: '🎉 FORMATO 1 FUNCIONOU! Botões detectados.' });
                } else {
                    await this.sock.sendMessage(userNumber, { text: '❌ Formato 1 falhou - apenas texto.' });
                }
            } catch (error) {
                console.log('❌ Formato 1 erro:', error.message);
                await this.sock.sendMessage(userNumber, { text: `❌ Formato 1 erro: ${error.message}` });
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            // FORMATO 2: Template Buttons
            const format2 = {
                text: '🧪 *TESTE FORMATO 2 - Template Buttons*',
                footer: 'Teste de Template',
                templateButtons: [
                    {
                        index: 1,
                        quickReplyButton: {
                            displayText: '🚀 Template 1',
                            id: 'template1'
                        }
                    },
                    {
                        index: 2,
                        quickReplyButton: {
                            displayText: '⭐ Template 2',
                            id: 'template2'
                        }
                    }
                ]
            };

            await this.sock.sendMessage(userNumber, { text: '🧪 Testando Formato 2...' });
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
                const result2 = await this.sock.sendMessage(userNumber, format2);
                console.log('✅ Formato 2 enviado:', JSON.stringify(result2.message, null, 2));
                
                if (result2.message.templateMessage) {
                    await this.sock.sendMessage(userNumber, { text: '🎉 FORMATO 2 FUNCIONOU! Template detectado.' });
                } else {
                    await this.sock.sendMessage(userNumber, { text: '❌ Formato 2 falhou - apenas texto.' });
                }
            } catch (error) {
                console.log('❌ Formato 2 erro:', error.message);
                await this.sock.sendMessage(userNumber, { text: `❌ Formato 2 erro: ${error.message}` });
            }

            await new Promise(resolve => setTimeout(resolve, 2000));

            // FORMATO 3: Lista Interativa
            const format3 = {
                text: '🧪 *TESTE FORMATO 3 - Lista Interativa*',
                footer: 'Teste de Lista',
                title: 'Lista de Teste',
                buttonText: 'Ver Opções',
                sections: [
                    {
                        title: 'Opções de Teste',
                        rows: [
                            {
                                id: 'lista1',
                                title: '📋 Lista 1',
                                description: 'Primeira opção da lista'
                            },
                            {
                                id: 'lista2',
                                title: '📄 Lista 2',
                                description: 'Segunda opção da lista'
                            }
                        ]
                    }
                ]
            };

            await this.sock.sendMessage(userNumber, { text: '🧪 Testando Formato 3...' });
            await new Promise(resolve => setTimeout(resolve, 1000));

            try {
                const result3 = await this.sock.sendMessage(userNumber, format3);
                console.log('✅ Formato 3 enviado:', JSON.stringify(result3.message, null, 2));
                
                if (result3.message.listMessage) {
                    await this.sock.sendMessage(userNumber, { text: '🎉 FORMATO 3 FUNCIONOU! Lista detectada.' });
                } else {
                    await this.sock.sendMessage(userNumber, { text: '❌ Formato 3 falhou - apenas texto.' });
                }
            } catch (error) {
                console.log('❌ Formato 3 erro:', error.message);
                await this.sock.sendMessage(userNumber, { text: `❌ Formato 3 erro: ${error.message}` });
            }

            await new Promise(resolve => setTimeout(resolve, 2000));
            
            await this.sock.sendMessage(userNumber, { 
                text: '🧪 *TESTE CONCLUÍDO*\n\nVerifique os logs no terminal para ver qual formato funcionou.\n\n💡 Use o formato que mostrar "FUNCIONOU!" para implementar botões reais.' 
            });

        } catch (error) {
            console.error('❌ Erro no teste de botões:', error);
                         await this.sock.sendMessage(userNumber, { text: '❌ Erro no teste de botões: ' + error.message });
         }
     }

         /**
     * Processa respostas de Interactive Messages MODERNOS
     * @param {Object} m - Mensagem recebida
     */
    async handleModernInteractiveMessage(m) {
        try {
            const userNumber = m.key.remoteJid;
            const interactiveResponse = m.message.interactiveResponseMessage;
            
            console.log('🚀 Processando Interactive Response:', JSON.stringify(interactiveResponse, null, 2));
            
            let buttonId = null;
            
            // Verificar diferentes tipos de resposta
            if (interactiveResponse.nativeFlowResponseMessage) {
                const nativeFlow = interactiveResponse.nativeFlowResponseMessage;
                console.log('⚡ Native Flow Response:', JSON.stringify(nativeFlow, null, 2));
                
                // Verificar se tem paramsJson
                if (nativeFlow.paramsJson) {
                    try {
                        const params = JSON.parse(nativeFlow.paramsJson);
                        buttonId = params.id;
                        console.log('🎯 Button ID extraído do Native Flow:', buttonId);
                    } catch (parseError) {
                        console.log('❌ Erro ao fazer parse dos parâmetros Native Flow:', parseError);
                    }
                }
            }
            
            // Se tem quickReplyMessage (formato mais comum)
            if (interactiveResponse.quickReplyMessage) {
                buttonId = interactiveResponse.quickReplyMessage.selectedId;
                console.log('🎯 Button ID extraído do Quick Reply:', buttonId);
            }
            
            // Se não conseguiu extrair ID, usar o primeiro campo disponível
            if (!buttonId && interactiveResponse.body) {
                buttonId = interactiveResponse.body.text;
                console.log('🎯 Button ID extraído do body:', buttonId);
            }
            
            if (buttonId) {
                console.log(`✅ Processando resposta interativa moderna: ${buttonId}`);
                await this.handleButtonResponse(userNumber, buttonId);
            } else {
                console.log('❌ Não foi possível extrair buttonId da resposta interativa');
                await this.sendFallbackMenu(userNumber);
            }
            
        } catch (error) {
            console.error('❌ Erro ao processar Interactive Message moderno:', error);
            const userNumber = m.key.remoteJid;
            await this.sendFallbackMenu(userNumber);
        }
    }

    /**
     * Testa formatos modernos de Interactive Messages
     * @param {string} userNumber - Número do usuário
     */
    async testModernFormats(userNumber) {
         try {
             console.log('🚀 Testando formatos MODERNOS de Interactive Messages...');
             
             // FORMATO MODERNO 1: Interactive Message com Quick Reply
             const modernFormat1 = {
                 interactiveMessage: {
                     body: {
                         text: "🚀 *TESTE MODERNO 1 - Interactive Message*\n\nSelecione uma opção:"
                     },
                     footer: {
                         text: "Bot de Atendimento v2.1"
                     },
                     header: {
                         title: "Teste Interactive",
                         hasMediaAttachment: false
                     },
                     nativeFlowMessage: {
                         buttons: [
                             {
                                 name: "quick_reply",
                                 buttonParamsJson: JSON.stringify({
                                     display_text: "✅ Opção A",
                                     id: "opcao_a"
                                 })
                             },
                             {
                                 name: "quick_reply", 
                                 buttonParamsJson: JSON.stringify({
                                     display_text: "🔥 Opção B",
                                     id: "opcao_b"
                                 })
                             }
                         ]
                     }
                 }
             };

             await this.sock.sendMessage(userNumber, { text: '🚀 Testando Formato Moderno 1...' });
             await new Promise(resolve => setTimeout(resolve, 1000));
             
             try {
                 const result1 = await this.sock.sendMessage(userNumber, modernFormat1);
                 console.log('✅ Formato Moderno 1 enviado:', JSON.stringify(result1.message, null, 2));
                 
                 if (result1.message.interactiveMessage) {
                     await this.sock.sendMessage(userNumber, { text: '🎉 FORMATO MODERNO 1 FUNCIONOU! Interactive Message detectado.' });
                 } else {
                     await this.sock.sendMessage(userNumber, { text: '❌ Formato Moderno 1 falhou - apenas texto.' });
                 }
             } catch (error) {
                 console.log('❌ Formato Moderno 1 erro:', error.message);
                 await this.sock.sendMessage(userNumber, { text: `❌ Formato Moderno 1 erro: ${error.message}` });
             }

             await new Promise(resolve => setTimeout(resolve, 2000));

             // FORMATO MODERNO 2: Interactive Message com Single Select
             const modernFormat2 = {
                 interactiveMessage: {
                     body: {
                         text: "🎯 *TESTE MODERNO 2 - Single Select*\n\nEscolha uma das opções:"
                     },
                     footer: {
                         text: "Teste de Seleção"
                     },
                     nativeFlowMessage: {
                         buttons: [
                             {
                                 name: "single_select",
                                 buttonParamsJson: JSON.stringify({
                                     title: "Ver Opções",
                                     sections: [
                                         {
                                             title: "Opções Disponíveis",
                                             rows: [
                                                 {
                                                     id: "select_1",
                                                     title: "📋 Seleção 1",
                                                     description: "Primeira opção de seleção"
                                                 },
                                                 {
                                                     id: "select_2", 
                                                     title: "📄 Seleção 2",
                                                     description: "Segunda opção de seleção"
                                                 }
                                             ]
                                         }
                                     ]
                                 })
                             }
                         ]
                     }
                 }
             };

             await this.sock.sendMessage(userNumber, { text: '🎯 Testando Formato Moderno 2...' });
             await new Promise(resolve => setTimeout(resolve, 1000));

             try {
                 const result2 = await this.sock.sendMessage(userNumber, modernFormat2);
                 console.log('✅ Formato Moderno 2 enviado:', JSON.stringify(result2.message, null, 2));
                 
                 if (result2.message.interactiveMessage) {
                     await this.sock.sendMessage(userNumber, { text: '🎉 FORMATO MODERNO 2 FUNCIONOU! Single Select detectado.' });
                 } else {
                     await this.sock.sendMessage(userNumber, { text: '❌ Formato Moderno 2 falhou - apenas texto.' });
                 }
             } catch (error) {
                 console.log('❌ Formato Moderno 2 erro:', error.message);
                 await this.sock.sendMessage(userNumber, { text: `❌ Formato Moderno 2 erro: ${error.message}` });
             }

             await new Promise(resolve => setTimeout(resolve, 2000));

             // FORMATO MODERNO 3: Interactive Message com Flow (mais avançado)
             const modernFormat3 = {
                 interactiveMessage: {
                     body: {
                         text: "⚡ *TESTE MODERNO 3 - Flow Message*\n\nInteração avançada:"
                     },
                     footer: {
                         text: "Teste de Flow"
                     },
                     nativeFlowMessage: {
                         buttons: [
                             {
                                 name: "cta_url",
                                 buttonParamsJson: JSON.stringify({
                                     display_text: "🌐 Link Teste",
                                     url: "https://github.com",
                                     merchant_url: "https://github.com"
                                 })
                             },
                             {
                                 name: "quick_reply",
                                 buttonParamsJson: JSON.stringify({
                                     display_text: "⚡ Flow Rápido",
                                     id: "flow_teste"
                                 })
                             }
                         ]
                     }
                 }
             };

             await this.sock.sendMessage(userNumber, { text: '⚡ Testando Formato Moderno 3...' });
             await new Promise(resolve => setTimeout(resolve, 1000));

             try {
                 const result3 = await this.sock.sendMessage(userNumber, modernFormat3);
                 console.log('✅ Formato Moderno 3 enviado:', JSON.stringify(result3.message, null, 2));
                 
                 if (result3.message.interactiveMessage) {
                     await this.sock.sendMessage(userNumber, { text: '🎉 FORMATO MODERNO 3 FUNCIONOU! Flow Message detectado.' });
                 } else {
                     await this.sock.sendMessage(userNumber, { text: '❌ Formato Moderno 3 falhou - apenas texto.' });
                 }
             } catch (error) {
                 console.log('❌ Formato Moderno 3 erro:', error.message);
                 await this.sock.sendMessage(userNumber, { text: `❌ Formato Moderno 3 erro: ${error.message}` });
             }

             await new Promise(resolve => setTimeout(resolve, 2000));
             
             await this.sock.sendMessage(userNumber, { 
                 text: '🚀 *TESTE MODERNO CONCLUÍDO*\n\nEsses são os formatos mais novos do WhatsApp Business API.\n\n💡 Se algum mostrar "FUNCIONOU!", usaremos esse formato!' 
             });

         } catch (error) {
             console.error('❌ Erro no teste moderno:', error);
             await this.sock.sendMessage(userNumber, { text: '❌ Erro no teste moderno: ' + error.message });
         }
     }
}

module.exports = MessageHandler;
