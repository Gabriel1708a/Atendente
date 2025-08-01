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
     * Envia menu de boas-vindas - versão simplificada que sempre funciona
     * @param {string} userNumber - Número do usuário
     */
    async sendWelcomeMenu(userNumber) {
        try {
            // Vai direto para o menu numerado que sempre funciona
            await this.sendFallbackMenu(userNumber);
            console.log(`✅ Menu numerado enviado para ${userNumber}`);
            
        } catch (error) {
            console.error('❌ Erro ao enviar menu:', error);
        }
    }

    /**
     * Envia menu fallback com emojis numerados (SEMPRE FUNCIONA)
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

_Digite 1 ou 2 para continuar_

---
💡 _Dica: Digite "menu" a qualquer momento para ver as opções novamente_`;

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
                    console.log(`🔢 Usuário ${userNumber} escolheu opção 1 (Suporte)`);
                    break;
                case '2':
                    buttonId = 'info_bot';
                    console.log(`🔢 Usuário ${userNumber} escolheu opção 2 (Info Bot)`);
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

📱 *wa.me/5599999999999*

🕒 *Horário de atendimento:*
Segunda a Sexta: 08:00 às 18:00
Sábado: 08:00 às 12:00

⚡ Resposta em até 30 minutos!

---
🔄 _Digite "menu" para voltar ao início_`;
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

💡 **Como usar:**
• Digite "oi" ou "menu" - Exibe menu
• Digite 1 ou 2 - Navegação rápida

🔧 **Status:** ✅ Online e funcionando

---
🔄 _Digite "menu" a qualquer momento para voltar ao início_`;
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