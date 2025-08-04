const { generateWAMessageFromContent, proto } = require('@whiskeysockets/baileys'); const VideoHandler = require('./videoHandler');

/**

Handler para processar mensagens recebidas e responder com diferentes tipos de botões interativos */ class MessageHandler { constructor(sock) { this.sock = sock; this.videoHandler = new VideoHandler(sock); this.botInfo = { name: "Bot de Atendimento WhatsApp", version: "2.0.0", description: "Bot automatizado para atendimento ao cliente com suporte a vídeos" }; }

/**

Processa mensagens recebidas

@param {Object} m - Objeto da mensagem */ async handleMessage(m) { try { const messageType = Object.keys(m.message)[0]; const userNumber = m.key.remoteJid;

console.log(`📥 Tipo de mensagem recebida: ${messageType} de ${userNumber}`);

 // Verifica se é comando !uparvideo em vídeo
 if (messageType === 'videoMessage') {
     const caption = m.message.videoMessage?.caption || '';
     if (caption.toLowerCase().includes('!uparvideo')) {
         await this.videoHandler.handleVideoUpload(m, userNumber);
         return;
     }
 }

 // Resposta a botão interativo – detecção geral
 if (messageType === 'buttonsResponseMessage') {
     console.log(`🔘 Resposta de botão detectada de ${userNumber}`);
     await this.handleButtonMessage(m);
     return;
 }

 // Resposta a lista interativa
 if (messageType === 'listResponseMessage') {
     console.log(`📋 Resposta de lista detectada de ${userNumber}`);
     await this.handleListMessage(m);
     return;
 }

 // TEXTO: ativação via menu passa a usar botões
 if (messageType === 'conversation' || messageType === 'extendedTextMessage') {
     const messageText = m.message.conversation || m.message.extendedTextMessage?.text || '';
     console.log(`📩 Mensagem recebida de ${userNumber}: ${messageText}`);

     if (this.isActivationCommand(messageText)) {
         console.log('▶️ Ativação de menu via botões');
         await this.sendBotInfoButtons(userNumber);
         return;
     }

     // ... restante do seu fluxo existente para texto ...
 }

} catch (error) { console.error('❌ Erro ao processar mensagem:', error); } }


// ... outros métodos inalterados ...

/**

[BACKUP] Envia menu de informações do bot com botões interativos

@param {string} userNumber - Número do usuário */ async sendBotInfoButtons(userNumber) { console.log(🔘 sendBotInfoButtons chamado para ${userNumber}); try { await this.sendTypingEffect(userNumber, 1500);

const buttons = [
     { buttonId: 'bot_versao',   buttonText: { displayText: '🤖 Versão do Bot' },     type: 1 },
     { buttonId: 'bot_recursos', buttonText: { displayText: '⚙️ Recursos' },       type: 1 },
     { buttonId: 'bot_comandos', buttonText: { displayText: '📜 Comandos' },       type: 1 },
     { buttonId: 'bot_suporte',  buttonText: { displayText: '🆘 Suporte Técnico' }, type: 1 },
     { buttonId: 'bot_sobre',    buttonText: { displayText: 'ℹ️ Sobre o Sistema' }, type: 1 }
 ];

 const buttonMessage = {
     text: `🤖 *INFORMAÇÕES DO BOT*\n\nSelecione uma opção para obter informações detalhadas:`,
     footer: '🔧 Bot de Atendimento WhatsApp v2.1',
     buttons,
     headerType: 1
 };

 console.log(`📋 Payload de botões: ${JSON.stringify(buttonMessage, null, 2)}`);

 let result;
 try {
     result = await this.sock.sendMessage(userNumber, buttonMessage);
     console.log(`✅ Formato padrão funcionou!`);
 } catch (firstError) {
     console.log(`⚠️ Formato padrão falhou (${firstError.message}), tentando List Message...`);
     const listMessage = {
         text: buttonMessage.text,
         footer: buttonMessage.footer,
         title: 'Menu de Opções',
         buttonText: 'Ver Opções',
         sections: [{
             title: 'Informações Disponíveis',
             rows: buttons.map(b => ({ id: b.buttonId, title: b.buttonText.displayText }))
         }]
     };
     result = await this.sock.sendMessage(userNumber, listMessage);
     console.log(`✅ List Message funcionou!`);
 }

 console.log(`✅ Menu de botões enviado com sucesso para ${userNumber}`);
 console.log(JSON.stringify(result, null, 2));

} catch (error) { console.error('❌ ERRO no sendBotInfoButtons:', error); } } }



module.exports = MessageHandler;
