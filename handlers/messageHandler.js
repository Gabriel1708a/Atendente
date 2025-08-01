const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys');

/**
 * Handler para processar mensagens recebidas e responder com botões interativos
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
            }
            
            // Verifica se é resposta de botão
            if (messageType === 'buttonsResponseMessage') {
                const buttonResponse = m.message.buttonsResponseMessage;
                const userNumber = m.key.remoteJid;
                
                console.log(`🔘 Botão clicado: ${buttonResponse.selectedButtonId}`);
                
                await this.handleButtonResponse(userNumber, buttonResponse.selectedButtonId);
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
     * Envia menu de boas-vindas com botões
     * @param {string} userNumber - Número do usuário
     */
    async sendWelcomeMenu(userNumber) {
        try {
            const welcomeMessage = `🎉 *Olá! Bem-vindo ao nosso atendimento!*

Escolha uma das opções abaixo para continuar:`;

            const buttons = [
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
            ];

            const buttonMessage = {
                text: welcomeMessage,
                footer: 'Powered by Baileys Bot v1.0',
                buttons: buttons,
                headerType: 1
            };

            await this.sock.sendMessage(userNumber, buttonMessage);
            console.log(`✅ Menu enviado para ${userNumber}`);

        } catch (error) {
            console.error('❌ Erro ao enviar menu:', error);
            
            // Fallback: envia mensagem simples sem botões
            await this.sock.sendMessage(userNumber, {
                text: `🎉 *Olá! Bem-vindo ao nosso atendimento!*

Opções disponíveis:
• Digite "suporte" para falar com nosso suporte
• Digite "info" para informações sobre o bot`
            });
        }
    }

    /**
     * Processa resposta dos botões
     * @param {string} userNumber - Número do usuário
     * @param {string} buttonId - ID do botão clicado
     */
    async handleButtonResponse(userNumber, buttonId) {
        try {
            let responseMessage = '';

            switch (buttonId) {
                case 'suporte':
                    responseMessage = `🌐 *Suporte ao Cliente*

Para falar com nosso suporte humano, clique no link abaixo:

📱 wa.me/5599999999999

Horário de atendimento:
Segunda a Sexta: 08:00 às 18:00
Sábado: 08:00 às 12:00

⚡ Resposta em até 30 minutos!`;
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
• "oi" ou "menu" - Exibe este menu
• Botões interativos para navegação

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