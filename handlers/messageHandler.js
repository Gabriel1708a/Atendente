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
}

module.exports = MessageHandler;
