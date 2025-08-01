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
            
            // Verifica se é comando !uparvideo em vídeo
            if (messageType === 'videoMessage') {
                const caption = m.message.videoMessage?.caption || '';
                if (caption.toLowerCase().includes('!uparvideo')) {
                    await this.videoHandler.handleVideoUpload(m, userNumber);
                    return;
                }
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
            // Obtém etapas disponíveis para mapear o número
            const availableSteps = this.videoHandler.getAvailableStepsForUser(userNumber);
            const optionIndex = parseInt(option) - 1;
            
            if (optionIndex < 0 || optionIndex >= availableSteps.length) {
                await this.sock.sendMessage(userNumber, {
                    text: `❓ Opção inválida. Digite "menu" para ver as opções disponíveis (1-${availableSteps.length}).`
                });
                return;
            }
            
            const selectedStepId = availableSteps[optionIndex];
            console.log(`🔢 Usuário ${userNumber} escolheu opção ${option} (${selectedStepId})`);
            
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
                    // Envia apenas vídeo se disponível, sem texto automático
                    const sentBotVideo = await this.sendVideoIfAvailable(userNumber, 'info_bot');
                    if (sentBotVideo) {
                        // Se tem vídeo, envia só o vídeo com legenda personalizada
                        return; // Não envia mais nada
                    } else {
                        // Se não tem vídeo, não envia nada (etapa vazia)
                        responseMessage = `ℹ️ *Esta etapa está em configuração*\n\n🔧 Use o comando !gerenciar para configurar esta seção.`;
                    }
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
}

module.exports = MessageHandler;