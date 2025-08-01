const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

/**
 * Handler para processar mensagens recebidas e responder com diferentes tipos de botões interativos
 */
class MessageHandler {
    constructor(sock) {
        this.sock = sock;
        this.botInfo = {
            name: "Bot de Atendimento WhatsApp",
            version: "1.0.0",
            description: "Bot automatizado para atendimento ao cliente"
        };
    }

    /**
     * Processa mensagens recebidas
     * @param {Object} m - Objeto da mensagem
     */
    async handleMessage(m) {
        try {
            const messageType = Object.keys(m.message)[0];
            
            // Verifica se é uma mensagem de texto
            if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
                const messageText = m.message.conversation || m.message.extendedTextMessage?.text || '';
                const userNumber = m.key.remoteJid;
                
                console.log(`📩 Mensagem recebida de ${userNumber}: ${messageText}`);
                
                // Verifica se é comando de ativação
                if (this.isActivationCommand(messageText)) {
                    await this.sendWelcomeMenu(userNumber);
                }
                
                // Verifica se é resposta numérica (1, 2)
                if (this.isNumericResponse(messageText)) {
                    await this.handleNumericResponse(userNumber, messageText.trim());
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
     * Verifica se é uma resposta numérica (1 ou 2)
     * @param {string} text - Texto da mensagem
     * @returns {boolean}
     */
    isNumericResponse(text) {
        const numericResponses = ['1', '2'];
        return numericResponses.includes(text.trim());
    }

    /**
     * Envia menu de boas-vindas com diferentes tipos de botões
     * @param {string} userNumber - Número do usuário
     */
    async sendWelcomeMenu(userNumber) {
        try {
            // Tentativa 1: Lista interativa (mais moderna)
            const success = await this.sendInteractiveList(userNumber);
            if (success) return;

            // Tentativa 2: Botões tradicionais
            const buttonSuccess = await this.sendTraditionalButtons(userNumber);
            if (buttonSuccess) return;

            // Fallback: Menu com emojis numerados
            await this.sendFallbackMenu(userNumber);

        } catch (error) {
            console.error('❌ Erro ao enviar menu:', error);
            await this.sendFallbackMenu(userNumber);
        }
    }

    /**
     * Envia lista interativa (método mais moderno)
     * @param {string} userNumber - Número do usuário
     * @returns {boolean} - Sucesso ou falha
     */
    async sendInteractiveList(userNumber) {
        try {
            const listMessage = {
                text: "🎉 *Olá! Bem-vindo ao nosso atendimento!*",
                footer: "Powered by Baileys Bot v1.0",
                title: "Menu de Atendimento",
                buttonText: "Ver Opções 📋",
                sections: [
                    {
                        title: "Escolha uma opção:",
                        rows: [
                            {
                                rowId: "suporte",
                                title: "Suporte 🌐",
                                description: "Falar com nosso suporte técnico"
                            },
                            {
                                rowId: "info_bot",
                                title: "Informações Bot 🤖", 
                                description: "Conhecer mais sobre este bot"
                            }
                        ]
                    }
                ]
            };

            await this.sock.sendMessage(userNumber, listMessage);
            console.log(`✅ Lista interativa enviada para ${userNumber}`);
            return true;

        } catch (error) {
            console.log(`⚠️ Lista interativa falhou para ${userNumber}: ${error.message}`);
            return false;
        }
    }

    /**
     * Envia botões tradicionais
     * @param {string} userNumber - Número do usuário  
     * @returns {boolean} - Sucesso ou falha
     */
    async sendTraditionalButtons(userNumber) {
        try {
            const buttonMessage = {
                text: `🎉 *Olá! Bem-vindo ao nosso atendimento!*

Escolha uma das opções abaixo para continuar:`,
                footer: 'Powered by Baileys Bot v1.0',
                buttons: [
                    {
                        buttonId: 'suporte',
                        buttonText: { displayText: 'Suporte 🌐' },
                        type: 1
                    },
                    {
                        buttonId: 'info_bot',
                        buttonText: { displayText: 'Informações Bot 🤖' },
                        type: 1
                    }
                ],
                headerType: 1
            };

            await this.sock.sendMessage(userNumber, buttonMessage);
            console.log(`✅ Botões tradicionais enviados para ${userNumber}`);
            return true;

        } catch (error) {
            console.log(`⚠️ Botões tradicionais falharam para ${userNumber}: ${error.message}`);
            return false;
        }
    }

    /**
     * Envia menu fallback com emojis numerados
     * @param {string} userNumber - Número do usuário
     */
    async sendFallbackMenu(userNumber) {
        try {
            const fallbackMessage = `🎉 *Olá! Bem-vindo ao nosso atendimento!*

Escolha uma das opções digitando o número correspondente:

*1️⃣ Suporte 🌐*
Falar com nosso suporte técnico

*2️⃣ Informações Bot 🤖*
Conhecer mais sobre este bot

_Digite 1 ou 2 para continuar_`;

            await this.sock.sendMessage(userNumber, { text: fallbackMessage });
            console.log(`✅ Menu fallback enviado para ${userNumber}`);

        } catch (error) {
            console.error('❌ Erro ao enviar menu fallback:', error);
        }
    }

    /**
     * Processa resposta numérica do usuário
     * @param {string} userNumber - Número do usuário
     * @param {string} option - Opção selecionada (1 ou 2)
     */
    async handleNumericResponse(userNumber, option) {
        try {
            let buttonId = '';
            
            switch (option) {
                case '1':
                    buttonId = 'suporte';
                    break;
                case '2':
                    buttonId = 'info_bot';
                    break;
                default:
                    await this.sock.sendMessage(userNumber, {
                        text: '❓ Opção inválida. Digite "menu" para ver as opções disponíveis ou escolha 1 ou 2.'
                    });
                    return;
            }

            await this.handleButtonResponse(userNumber, buttonId);

        } catch (error) {
            console.error('❌ Erro ao processar resposta numérica:', error);
        }
    }

    /**
     * Processa resposta dos botões e listas
     * @param {string} userNumber - Número do usuário
     * @param {string} buttonId - ID do botão/opção clicado
     */
    async handleButtonResponse(userNumber, buttonId) {
        try {
            let responseMessage = '';

            switch (buttonId) {
                case 'suporte':
                    responseMessage = `🌐 *Suporte ao Cliente*

Para falar com nosso suporte humano, clique no link abaixo:

📱 wa.me/5599999999999

🕒 *Horário de atendimento:*
Segunda a Sexta: 08:00 às 18:00
Sábado: 08:00 às 12:00

⚡ Resposta em até 30 minutos!

_Digite "menu" para voltar ao início_`;
                    break;

                case 'info_bot':
                    responseMessage = `🤖 *Informações do Bot*

📋 **Nome:** ${this.botInfo.name}
🔢 **Versão:** ${this.botInfo.version}
📝 **Descrição:** ${this.botInfo.description}

🛠️ **Tecnologias:**
• Node.js 18+
• Baileys WhatsApp Library
• Estrutura modular

💡 **Comandos disponíveis:**
• "oi" ou "menu" - Exibe menu interativo
• Digite 1 ou 2 para navegação rápida

🔄 Digite "menu" a qualquer momento para voltar ao início.`;
                    break;

                default:
                    responseMessage = '❓ Opção não reconhecida. Digite "menu" para ver as opções disponíveis.';
            }

            await this.sock.sendMessage(userNumber, { text: responseMessage });
            console.log(`✅ Resposta enviada para ${userNumber}: ${buttonId}`);

        } catch (error) {
            console.error('❌ Erro ao processar resposta do botão:', error);
        }
    }
}

module.exports = MessageHandler;