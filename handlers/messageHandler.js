const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');
const VideoHandler = require('./videoHandler');

/**
 * Handler para processar mensagens recebidas e responder com diferentes tipos de botões interativos
 */
class MessageHandler {
    constructor(sock) {
        this.sock = sock;
        this.videoHandler = new VideoHandler(sock);
        this.botInfo = {
            name: "Bot de Atendimento WhatsApp",
            version: "2.0.0",
            description: "Bot automatizado para atendimento ao cliente com suporte a vídeos"
        };
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

                // Verifica se é comando !gerenciar
                if (messageText.toLowerCase().trim() === '!gerenciar') {
                    await this.sendStepManagementMenu(userNumber);
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

                // Verifica se é comando !criarcondicional
                if (messageText.toLowerCase().startsWith('!criarcondicional')) {
                    const parts = messageText.split(' ');
                    if (parts.length >= 4) {
                        const stepId = parts[1];
                        const showAfter = parts[2];
                        const stepName = parts.slice(3).join(' ');
                        
                        this.videoHandler.addConditionalStep(stepId, showAfter, stepName);
                        
                        await this.sendTypingEffect(userNumber, 1500);
                        await this.sock.sendMessage(userNumber, {
                            text: `✅ *Etapa condicional criada!*\n\n📝 **Nome:** ${stepName}\n🔗 **Aparece após:** ${showAfter}\n🆔 **ID:** ${stepId}\n\n💡 Agora envie um vídeo com "!uparvideo" e escolha esta etapa, ou use !gerenciar para configurar.`
                        });
                    } else {
                        await this.sock.sendMessage(userNumber, {
                            text: '❌ *Formato incorreto*\n\n📋 **Como usar:**\n!criarcondicional [id] [etapa-requisito] [nome]\n\n💡 **Exemplo:**\n!criarcondicional promocoes suporte Promoções Especiais'
                        });
                    }
                    return;
                }
                
                // Verifica se é resposta numérica (1, 2, etc.)
                if (this.isNumericResponse(messageText)) {
                    await this.handleNumericResponse(userNumber, messageText.trim());
                    return;
                }
            }
            
            // Verifica se é resposta de botão tradicional
            if (messageType === 'buttonsResponseMessage') {
                const buttonResponse = m.message.buttonsResponseMessage;
                const userNumber = m.key.remoteJid;
                
                console.log(`🔘 Botão clicado: ${buttonResponse.selectedButtonId}`);
                await this.handleButtonResponse(userNumber, buttonResponse.selectedButtonId);
            }

            // Verifica se é resposta de lista interativa
            if (messageType === 'listResponseMessage') {
                const listResponse = m.message.listResponseMessage;
                const userNumber = m.key.remoteJid;
                
                console.log(`📋 Lista selecionada: ${listResponse.singleSelectReply.selectedRowId}`);
                await this.handleButtonResponse(userNumber, listResponse.singleSelectReply.selectedRowId);
            }

        } catch (error) {
            console.error('❌ Erro ao processar mensagem:', error);
        }
    }

    /**
     * Verifica se a mensagem é um comando de ativação
     * @param {string} text - Texto da mensagem
     * @returns {boolean}
     */
    isActivationCommand(text) {
        const activationWords = ['oi', 'menu', 'OI', 'MENU', 'Oi', 'Menu'];
        return activationWords.includes(text.trim());
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
            console.error('❌ Erro no efeito de digitação:', error);
        }
    }

    /**
     * Envia vídeo se disponível para a seção
     * @param {string} userNumber - Número do usuário
     * @param {string} section - Seção (welcome, suporte, info_bot)
     */
    async sendVideoIfAvailable(userNumber, section) {
        try {
            if (this.videoHandler.hasVideoForSection(section)) {
                const videoPath = this.videoHandler.getVideoForSection(section);
                const fs = require('fs');
                
                if (fs.existsSync(videoPath)) {
                    await this.sendTypingEffect(userNumber, 1500);
                    
                    // Obtém legenda personalizada ou usa padrão
                    const customCaption = this.videoHandler.videoConfig.captions?.[section] || `🎥 *Vídeo informativo*`;
                    
                    await this.sock.sendMessage(userNumber, {
                        video: fs.readFileSync(videoPath),
                        caption: customCaption
                    });
                    console.log(`🎥 Vídeo ${section} enviado para ${userNumber}`);
                    return true;
                }
            }
        } catch (error) {
            console.error(`❌ Erro ao enviar vídeo ${section}:`, error);
        }
        return false;
    }

    /**
     * Envia menu de boas-vindas - versão simplificada que sempre funciona
     * @param {string} userNumber - Número do usuário
     */
    async sendWelcomeMenu(userNumber) {
        try {
            // Efeito de digitação realista
            await this.sendTypingEffect(userNumber, 2500);
            
            // Envia vídeo de boas-vindas se disponível
            await this.sendVideoIfAvailable(userNumber, 'welcome');
            
            // Pequena pausa antes do menu
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Vai direto para o menu numerado que sempre funciona
            await this.sendFallbackMenu(userNumber);
            console.log(`✅ Menu numerado enviado para ${userNumber}`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar menu:', error);
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
     * Envia menu de gerenciamento de etapas
     * @param {string} userNumber - Número do usuário
     */
    async sendStepManagementMenu(userNumber) {
        try {
            await this.sendTypingEffect(userNumber, 2000);
            
            // Carrega configuração atual de vídeos
            const videoConfig = this.videoHandler.videoConfig;
            
            const menuMessage = `🔧 *GERENCIADOR DE ETAPAS*

📋 *Etapas Disponíveis:*

*1️⃣ Menu Principal (Boas-vindas)*
${videoConfig.welcome ? '🎥 Com vídeo' : '📝 Apenas texto'}

*2️⃣ Seção Suporte*
${videoConfig.suporte ? '🎥 Com vídeo' : '📝 Apenas texto'}

*3️⃣ Informações do Bot*
${videoConfig.info_bot ? '🎥 Com vídeo' : '📝 Sem conteúdo'}

*4️⃣ Seções Personalizadas*
${videoConfig.custom && videoConfig.custom.length > 0 ? `📊 ${videoConfig.custom.length} seção(ões)` : '🆕 Nenhuma'}

---

*📝 COMANDOS DISPONÍVEIS:*
• !editar [número] - Editar etapa
• !criar - Criar nova etapa
• !excluir [número] - Excluir etapa
• !legenda [número] - Editar legenda do vídeo
• !listar - Ver detalhes de todas etapas

💡 *Exemplo:* !editar 3`;

            await this.sock.sendMessage(userNumber, { text: menuMessage });
            console.log(`✅ Menu de gerenciamento enviado para ${userNumber}`);

        } catch (error) {
            console.error('❌ Erro ao enviar menu de gerenciamento:', error);
        }
    }

    /**
     * Processa resposta dos botões e listas
     * @param {string} userNumber - Número do usuário
     * @param {string} buttonId - ID do botão/opção clicado
     */
    async handleButtonResponse(userNumber, buttonId) {
        try {
            // Efeito de digitação realista antes da resposta
            await this.sendTypingEffect(userNumber, 2200);
            
            let responseMessage = '';

            switch (buttonId) {
                case 'suporte':
                    // Envia vídeo de suporte se disponível
                    const sentSuporteVideo = await this.sendVideoIfAvailable(userNumber, 'suporte');
                    if (sentSuporteVideo) {
                        await new Promise(resolve => setTimeout(resolve, 1500));
                        await this.sendTypingEffect(userNumber, 1500);
                    }
                    
                    responseMessage = `🌐 *Suporte ao Cliente*

Para falar com nosso suporte humano, clique no link abaixo:

📱 *wa.me/5599999999999*

🕒 *Horário de atendimento:*
Segunda a Sexta: 08:00 às 18:00
Sábado: 08:00 às 12:00

⚡ Resposta em até 30 minutos!

---
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
     * Manipula criação de nova etapa
     * @param {string} userNumber - Número do usuário
     */
    async handleCreateStep(userNumber) {
        try {
            await this.sendTypingEffect(userNumber, 1500);
            
            const createMessage = `🆕 *CRIAR NOVA ETAPA*

📝 **Escolha o tipo:**

**1️⃣ Etapa Normal**
Aparece sempre no menu principal

**2️⃣ Etapa Condicional** 
Aparece apenas após visitar outra etapa

---
💡 **Digite 1 ou 2 para continuar**`;

            await this.sock.sendMessage(userNumber, { text: createMessage });
            
            // Marca usuário como aguardando tipo de etapa
            this.videoHandler.setUserState(userNumber, 'awaiting_step_type');
            
        } catch (error) {
            console.error('❌ Erro ao processar !criar:', error);
        }
    }

    /**
     * Manipula edição de etapa
     * @param {string} userNumber - Número do usuário
     * @param {string} messageText - Comando completo
     */
    async handleEditStep(userNumber, messageText) {
        try {
            const parts = messageText.split(' ');
            if (parts.length < 2) {
                await this.sock.sendMessage(userNumber, {
                    text: '❌ **Formato incorreto**\n\n📋 **Como usar:**\n!editar [número]\n\n💡 **Exemplo:** !editar 2'
                });
                return;
            }

            const stepNumber = parseInt(parts[1]);
            const availableSteps = this.videoHandler.getAvailableStepsForUser(userNumber);
            
            if (stepNumber < 1 || stepNumber > availableSteps.length) {
                await this.sock.sendMessage(userNumber, {
                    text: `❌ **Etapa não encontrada**\n\nEtapas disponíveis: 1-${availableSteps.length}\n\n📜 Use !listar para ver todas as etapas`
                });
                return;
            }

            const stepId = availableSteps[stepNumber - 1];
            await this.sendTypingEffect(userNumber, 1500);
            
            const editMessage = `✏️ **EDITAR ETAPA ${stepNumber}**\n\n🆔 **ID:** ${stepId}\n\n**O que deseja editar?**\n\n1️⃣ Nome da etapa\n2️⃣ Legenda do vídeo\n3️⃣ Substituir vídeo\n4️⃣ Remover vídeo\n\n---\n💡 Digite 1, 2, 3 ou 4`;

            await this.sock.sendMessage(userNumber, { text: editMessage });
            
            // Armazena contexto de edição
            this.videoHandler.setUserState(userNumber, 'editing_step', { stepId, stepNumber });
            
        } catch (error) {
            console.error('❌ Erro ao processar !editar:', error);
        }
    }

    /**
     * Manipula exclusão de etapa
     * @param {string} userNumber - Número do usuário
     * @param {string} messageText - Comando completo
     */
    async handleDeleteStep(userNumber, messageText) {
        try {
            const parts = messageText.split(' ');
            if (parts.length < 2) {
                await this.sock.sendMessage(userNumber, {
                    text: '❌ **Formato incorreto**\n\n📋 **Como usar:**\n!excluir [número]\n\n💡 **Exemplo:** !excluir 3'
                });
                return;
            }

            const stepNumber = parseInt(parts[1]);
            const availableSteps = this.videoHandler.getAvailableStepsForUser(userNumber);
            
            if (stepNumber < 1 || stepNumber > availableSteps.length) {
                await this.sock.sendMessage(userNumber, {
                    text: `❌ **Etapa não encontrada**\n\nEtapas disponíveis: 1-${availableSteps.length}\n\n📜 Use !listar para ver todas as etapas`
                });
                return;
            }

            const stepId = availableSteps[stepNumber - 1];
            
            // Não permite excluir etapas principais
            if (['suporte', 'info_bot', 'welcome'].includes(stepId)) {
                await this.sock.sendMessage(userNumber, {
                    text: `⚠️ **Não é possível excluir etapas do sistema**\n\nEtapas protegidas: Suporte, Info Bot, Welcome\n\n💡 Use !editar para modificá-las`
                });
                return;
            }

            await this.sendTypingEffect(userNumber, 1500);
            
            const confirmMessage = `🗑️ **CONFIRMAR EXCLUSÃO**\n\n📝 **Etapa:** ${stepId}\n\n⚠️ **Esta ação não pode ser desfeita!**\n\n**Digite 'CONFIRMAR' para excluir ou qualquer outra coisa para cancelar**`;

            await this.sock.sendMessage(userNumber, { text: confirmMessage });
            
            // Armazena contexto de exclusão
            this.videoHandler.setUserState(userNumber, 'confirming_delete', { stepId, stepNumber });
            
        } catch (error) {
            console.error('❌ Erro ao processar !excluir:', error);
        }
    }

    /**
     * Manipula edição de legenda
     * @param {string} userNumber - Número do usuário
     * @param {string} messageText - Comando completo
     */
    async handleEditCaption(userNumber, messageText) {
        try {
            const parts = messageText.split(' ');
            if (parts.length < 2) {
                await this.sock.sendMessage(userNumber, {
                    text: '❌ **Formato incorreto**\n\n📋 **Como usar:**\n!legenda [número]\n\n💡 **Exemplo:** !legenda 1'
                });
                return;
            }

            const stepNumber = parseInt(parts[1]);
            const availableSteps = this.videoHandler.getAvailableStepsForUser(userNumber);
            
            if (stepNumber < 1 || stepNumber > availableSteps.length) {
                await this.sock.sendMessage(userNumber, {
                    text: `❌ **Etapa não encontrada**\n\nEtapas disponíveis: 1-${availableSteps.length}\n\n📜 Use !listar para ver todas as etapas`
                });
                return;
            }

            const stepId = availableSteps[stepNumber - 1];
            const currentCaption = this.videoHandler.videoConfig.captions?.[stepId] || 'Sem legenda';
            
            await this.sendTypingEffect(userNumber, 1500);
            
            const captionMessage = `🎬 **EDITAR LEGENDA - Etapa ${stepNumber}**\n\n🆔 **ID:** ${stepId}\n📝 **Legenda atual:**\n${currentCaption}\n\n**Digite a nova legenda:**`;

            await this.sock.sendMessage(userNumber, { text: captionMessage });
            
            // Armazena contexto de edição de legenda
            this.videoHandler.setUserState(userNumber, 'editing_caption', { stepId, stepNumber });
            
        } catch (error) {
            console.error('❌ Erro ao processar !legenda:', error);
        }
    }

    /**
     * Lista todas as etapas
     * @param {string} userNumber - Número do usuário
     */
    async handleListSteps(userNumber) {
        try {
            await this.sendTypingEffect(userNumber, 1500);
            
            const availableSteps = this.videoHandler.getAvailableStepsForUser(userNumber);
            const conditionalSteps = this.videoHandler.videoConfig.flow?.conditional || {};
            
            let listMessage = '📜 **LISTA DE ETAPAS**\n\n';
            
            for (let i = 0; i < availableSteps.length; i++) {
                const stepId = availableSteps[i];
                const stepNumber = i + 1;
                
                let stepName = '';
                let stepType = '';
                
                switch(stepId) {
                    case 'suporte':
                        stepName = 'Suporte';
                        stepType = '🔧 Sistema';
                        break;
                    case 'info_bot':
                        stepName = 'Informações Bot';
                        stepType = '🔧 Sistema';
                        break;
                    case 'welcome':
                        stepName = 'Boas-vindas';
                        stepType = '🔧 Sistema';
                        break;
                    default:
                        if (conditionalSteps[stepId]) {
                            stepName = conditionalSteps[stepId].name;
                            stepType = `✨ Condicional (após ${conditionalSteps[stepId].showAfter})`;
                        } else {
                            stepName = stepId;
                            stepType = '📝 Personalizada';
                        }
                }
                
                const hasVideo = this.videoHandler.hasVideoForSection(stepId) ? '🎥' : '❌';
                const caption = this.videoHandler.videoConfig.captions?.[stepId] || 'Sem legenda';
                
                listMessage += `**${stepNumber}️⃣ ${stepName}**\n`;
                listMessage += `📱 ${stepType}\n`;
                listMessage += `🎬 Vídeo: ${hasVideo}\n`;
                listMessage += `💬 Legenda: ${caption}\n\n`;
            }
            
            listMessage += '---\n💡 Use !editar, !legenda ou !excluir com o número da etapa';
            
            await this.sock.sendMessage(userNumber, { text: listMessage });
            
        } catch (error) {
            console.error('❌ Erro ao processar !listar:', error);
        }
    }

    /**
     * Processa mensagens baseadas no estado do usuário
     * @param {string} userNumber - Número do usuário
     * @param {string} messageText - Texto da mensagem
     * @param {object} userState - Estado atual do usuário
     */
    async handleUserStateMessage(userNumber, messageText, userState) {
        try {
            switch (userState.state) {
                case 'awaiting_step_type':
                    await this.handleStepTypeResponse(userNumber, messageText);
                    break;
                    
                case 'editing_step':
                    await this.handleEditStepResponse(userNumber, messageText, userState.data);
                    break;
                    
                case 'editing_caption':
                    await this.handleEditCaptionResponse(userNumber, messageText, userState.data);
                    break;
                    
                case 'confirming_delete':
                    await this.handleDeleteConfirmation(userNumber, messageText, userState.data);
                    break;
                    
                default:
                    // Estado não reconhecido, limpa e processa normalmente
                    this.videoHandler.clearUserState(userNumber);
            }
        } catch (error) {
            console.error('❌ Erro ao processar estado do usuário:', error);
            this.videoHandler.clearUserState(userNumber);
        }
    }

    /**
     * Processa resposta de tipo de etapa
     */
    async handleStepTypeResponse(userNumber, messageText) {
        const option = messageText.trim();
        
        if (option === '1') {
            // Etapa normal - ainda não implementado
            await this.sock.sendMessage(userNumber, {
                text: '🚧 **Em desenvolvimento**\n\nEtapas normais serão implementadas em breve.\n\n💡 Use !criarcondicional para criar etapas condicionais.'
            });
        } else if (option === '2') {
            // Etapa condicional
            await this.sock.sendMessage(userNumber, {
                text: '✨ **Criar Etapa Condicional**\n\n📋 **Use o comando:**\n!criarcondicional [id] [etapa-requisito] [nome]\n\n💡 **Exemplo:**\n!criarcondicional promocoes suporte Promoções Especiais'
            });
        } else {
            await this.sock.sendMessage(userNumber, {
                text: '❌ **Opção inválida**\n\nDigite 1 ou 2 para escolher o tipo de etapa.'
            });
            return;
        }
        
        this.videoHandler.clearUserState(userNumber);
    }

    /**
     * Processa resposta de edição de etapa
     */
    async handleEditStepResponse(userNumber, messageText, stepData) {
        const option = messageText.trim();
        
        switch (option) {
            case '1':
                await this.sock.sendMessage(userNumber, {
                    text: '🚧 **Edição de nome em desenvolvimento**\n\nEssa funcionalidade será implementada em breve.'
                });
                break;
            case '2':
                // Redireciona para edição de legenda
                await this.handleEditCaption(userNumber, `!legenda ${stepData.stepNumber}`);
                return; // Não limpa estado aqui
            case '3':
                await this.sock.sendMessage(userNumber, {
                    text: '🎥 **Substituir vídeo**\n\nEnvie um novo vídeo com "!uparvideo" e escolha esta etapa para substituir.'
                });
                break;
            case '4':
                await this.sock.sendMessage(userNumber, {
                    text: '🚧 **Remoção de vídeo em desenvolvimento**\n\nEssa funcionalidade será implementada em breve.'
                });
                break;
            default:
                await this.sock.sendMessage(userNumber, {
                    text: '❌ **Opção inválida**\n\nDigite 1, 2, 3 ou 4 para escolher a ação.'
                });
                return;
        }
        
        this.videoHandler.clearUserState(userNumber);
    }

    /**
     * Processa resposta de edição de legenda
     */
    async handleEditCaptionResponse(userNumber, messageText, stepData) {
        const newCaption = messageText.trim();
        
        if (newCaption.length === 0) {
            await this.sock.sendMessage(userNumber, {
                text: '❌ **Legenda não pode estar vazia**\n\nDigite uma nova legenda.'
            });
            return;
        }
        
        // Atualiza a legenda
        if (!this.videoHandler.videoConfig.captions) {
            this.videoHandler.videoConfig.captions = {};
        }
        
        this.videoHandler.videoConfig.captions[stepData.stepId] = newCaption;
        this.videoHandler.saveVideoConfig();
        
        await this.sendTypingEffect(userNumber, 1500);
        await this.sock.sendMessage(userNumber, {
            text: `✅ **Legenda atualizada!**\n\n🆔 **Etapa:** ${stepData.stepId}\n📝 **Nova legenda:**\n${newCaption}`
        });
        
        this.videoHandler.clearUserState(userNumber);
    }

    /**
     * Processa confirmação de exclusão
     */
    async handleDeleteConfirmation(userNumber, messageText, stepData) {
        const response = messageText.trim().toLowerCase();
        
        if (response === 'confirmar') {
            // Remove etapa condicional
            const conditionalSteps = this.videoHandler.videoConfig.flow?.conditional || {};
            
            if (conditionalSteps[stepData.stepId]) {
                delete conditionalSteps[stepData.stepId];
                
                // Remove legenda se existir
                if (this.videoHandler.videoConfig.captions && this.videoHandler.videoConfig.captions[stepData.stepId]) {
                    delete this.videoHandler.videoConfig.captions[stepData.stepId];
                }
                
                this.videoHandler.saveVideoConfig();
                
                await this.sendTypingEffect(userNumber, 1500);
                await this.sock.sendMessage(userNumber, {
                    text: `✅ **Etapa excluída com sucesso!**\n\n🗑️ **Etapa removida:** ${stepData.stepId}\n\n💡 A etapa não aparecerá mais nos menus.`
                });
            } else {
                await this.sock.sendMessage(userNumber, {
                    text: '❌ **Etapa não encontrada ou não pode ser excluída.**'
                });
            }
        } else {
            await this.sock.sendMessage(userNumber, {
                text: '❌ **Exclusão cancelada**\n\nA etapa foi mantida.'
            });
        }
        
        this.videoHandler.clearUserState(userNumber);
    }

    /**
     * Envia menu de informações do bot (SEMPRE FUNCIONA)
     * @param {string} userNumber - Número do usuário
     */
    async sendBotInfoMenu(userNumber) {
        try {
            await this.sendTypingEffect(userNumber, 1500);

            const menuMessage = `🤖 *INFORMAÇÕES DO BOT*

📋 **Selecione uma opção:**

*1️⃣ Versão do Bot* 
   Informações de versão e atualizações

*2️⃣ Recursos*
   Lista completa de funcionalidades

*3️⃣ Comandos*
   Guia de todos os comandos disponíveis

*4️⃣ Suporte Técnico*
   Ajuda e troubleshooting

*5️⃣ Sobre o Sistema*
   Missão e características

---
💡 _Digite o número da opção desejada (1-5)_
🔄 _Digite "menu" para voltar ao menu principal_`;

            await this.sock.sendMessage(userNumber, { text: menuMessage });
            console.log(`✅ Menu Info Bot enviado para ${userNumber}`);

        } catch (error) {
            console.error('❌ Erro ao enviar menu Info Bot:', error);
        }
    }

    /**
     * [BACKUP] Envia menu de informações do bot com botões interativos
     * @param {string} userNumber - Número do usuário
     */
    async sendBotInfoButtons(userNumber) {
        try {
            console.log(`🔘 Tentando enviar botões para ${userNumber}...`);
            await this.sendTypingEffect(userNumber, 1500);

            const buttons = [
                {
                    buttonId: 'bot_versao', 
                    buttonText: {displayText: '🤖 Versão do Bot'}, 
                    type: 1
                },
                {
                    buttonId: 'bot_recursos', 
                    buttonText: {displayText: '⚙️ Recursos'}, 
                    type: 1
                },
                {
                    buttonId: 'bot_comandos', 
                    buttonText: {displayText: '📜 Comandos'}, 
                    type: 1
                },
                {
                    buttonId: 'bot_suporte', 
                    buttonText: {displayText: '🆘 Suporte Técnico'}, 
                    type: 1
                },
                {
                    buttonId: 'bot_sobre', 
                    buttonText: {displayText: 'ℹ️ Sobre o Sistema'}, 
                    type: 1
                }
            ];

            // Tenta formato novo primeiro
            const buttonMessage = {
                text: `🤖 *INFORMAÇÕES DO BOT*

Selecione uma opção para obter informações detalhadas:`,
                footer: '🔧 Bot de Atendimento WhatsApp v2.1',
                buttons: buttons,
                headerType: 1
            };

            // Formato alternativo: List Message (mais compatível)
            const listMessage = {
                text: `🤖 *INFORMAÇÕES DO BOT*

Selecione uma opção para obter informações detalhadas:`,
                footer: '🔧 Bot de Atendimento WhatsApp v2.1',
                title: 'Menu de Opções',
                buttonText: 'Ver Opções',
                sections: [{
                    title: 'Informações Disponíveis',
                    rows: [
                        {id: 'bot_versao', title: '🤖 Versão do Bot', description: 'Informações de versão e atualizações'},
                        {id: 'bot_recursos', title: '⚙️ Recursos', description: 'Lista completa de funcionalidades'},
                        {id: 'bot_comandos', title: '📜 Comandos', description: 'Guia de todos os comandos'},
                        {id: 'bot_suporte', title: '🆘 Suporte Técnico', description: 'Ajuda e troubleshooting'},
                        {id: 'bot_sobre', title: 'ℹ️ Sobre o Sistema', description: 'Missão e características'}
                    ]
                }]
            };

            console.log(`📋 Tentando formato padrão...`);
            
            let result;
            try {
                result = await this.sock.sendMessage(userNumber, buttonMessage);
                
                // Verifica se realmente enviou botões (não apenas texto)
                if (result.message.extendedTextMessage && !result.message.buttonsMessage) {
                    throw new Error('Botões não suportados - apenas texto foi enviado');
                }
                
                console.log(`✅ Formato padrão funcionou!`);
            } catch (firstError) {
                console.log(`⚠️ Formato padrão falhou (${firstError.message}), tentando List Message...`);
                console.log(`📋 Estrutura List:`, JSON.stringify(listMessage, null, 2));
                result = await this.sock.sendMessage(userNumber, listMessage);
                console.log(`✅ List Message funcionou!`);
            }
            
            console.log(`✅ Resultado do envio:`, JSON.stringify(result, null, 2));
            console.log(`✅ Menu de botões enviado com sucesso para ${userNumber}`);

        } catch (error) {
            console.error('❌ ERRO DETALHADO ao enviar botões:');
            console.error('Tipo do erro:', error.constructor.name);
            console.error('Mensagem:', error.message);
            console.error('Stack:', error.stack);
            
            if (error.data) {
                console.error('Dados do erro:', JSON.stringify(error.data, null, 2));
            }
            
            console.log(`🔄 Enviando menu fallback para ${userNumber}...`);
            
            // Fallback para menu texto se botões falharem
            try {
                await this.sock.sendMessage(userNumber, {
                    text: `🤖 *INFORMAÇÕES DO BOT*

📋 **Opções disponíveis:**
1️⃣ Versão do Bot
2️⃣ Recursos
3️⃣ Comandos
4️⃣ Suporte Técnico 
5️⃣ Sobre o Sistema

_Digite o número da opção desejada_

⚠️ *Nota: Os botões interativos não estão disponíveis no momento*`
                });
                console.log(`✅ Menu fallback enviado para ${userNumber}`);
            } catch (fallbackError) {
                console.error('❌ Erro também no fallback:', fallbackError);
            }
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
}

module.exports = MessageHandler;