const fs = require('fs');
const path = require('path');

// Importa função de download se necessário
let downloadContentFromMessage;
try {
    ({ downloadContentFromMessage } = require('@whiskeysockets/baileys'));
} catch (error) {
    console.log('⚠️  downloadContentFromMessage não disponível como import direto');
}

/**
 * Handler para gerenciar vídeos do bot - comando !uparvideo
 */
class VideoHandler {
    constructor(sock) {
        this.sock = sock;
        this.videosDir = path.join(__dirname, '..', 'videos');
        this.configFile = path.join(this.videosDir, 'videos-config.json');
        this.awaitingVideoPlacement = new Map(); // Armazena usuários aguardando escolha de local
        
        // Cria diretório de vídeos se não existir
        this.ensureVideosDirectory();
        
        // Carrega configuração de vídeos
        this.videoConfig = this.loadVideoConfig();
    }

    /**
     * Garante que o diretório de vídeos existe
     */
    ensureVideosDirectory() {
        if (!fs.existsSync(this.videosDir)) {
            fs.mkdirSync(this.videosDir, { recursive: true });
            console.log('📁 Diretório de vídeos criado');
        }
    }

    /**
     * Carrega configuração de vídeos
     */
    loadVideoConfig() {
        try {
            if (fs.existsSync(this.configFile)) {
                const config = JSON.parse(fs.readFileSync(this.configFile, 'utf8'));
                console.log('📋 Configuração de vídeos carregada');
                return config;
            }
        } catch (error) {
            console.error('❌ Erro ao carregar config de vídeos:', error);
        }
        
        // Configuração padrão
        return {
            welcome: null,
            suporte: null,
            info_bot: null,
            custom: [],
            captions: {
                welcome: "🎥 *Vídeo de boas-vindas*",
                suporte: "🎥 *Vídeo informativo sobre suporte*",
                info_bot: "🎥 *Informações sobre o bot*"
            },
            // Sistema de fluxo condicional
            flow: {
                // Etapas que aparecem no menu principal
                mainMenu: ['suporte', 'info_bot'],
                // Etapas condicionais: aparecem apenas após visitar certas seções
                conditional: {
                    // Exemplo: etapa4 só aparece depois de visitar suporte
                    // 'etapa4': { showAfter: 'suporte', name: 'Nova Opção' }
                }
            },
            // Rastreamento de navegação por usuário
            userNavigation: {}
        };
    }

    /**
     * Salva configuração de vídeos
     */
    saveVideoConfig() {
        try {
            fs.writeFileSync(this.configFile, JSON.stringify(this.videoConfig, null, 2));
            console.log('💾 Configuração de vídeos salva');
        } catch (error) {
            console.error('❌ Erro ao salvar config de vídeos:', error);
        }
    }

    /**
     * Processa comando !uparvideo
     */
    async handleVideoUpload(message, userNumber) {
        try {
            // Verifica se a mensagem tem vídeo
            const videoMessage = message.message.videoMessage;
            if (!videoMessage) {
                await this.sendTypingEffect(userNumber);
                await this.sock.sendMessage(userNumber, {
                    text: '❌ *Comando !uparvideo deve ser usado com vídeo*\n\n📋 *Como usar:*\n1️⃣ Selecione ou grave um vídeo\n2️⃣ Adicione "!uparvideo" na legenda\n3️⃣ Envie para o bot\n\n💡 *Dica:* O vídeo deve ter menos de 16MB'
                });
                return;
            }

            console.log(`🎥 Comando !uparvideo recebido de ${userNumber}`);
            
            // Baixa o vídeo
            const videoBuffer = await this.downloadVideo(message);
            if (!videoBuffer) {
                await this.sendTypingEffect(userNumber);
                await this.sock.sendMessage(userNumber, {
                    text: '❌ *Erro ao baixar o vídeo*\n\n🔧 *Possíveis causas:*\n• Vídeo muito grande (limite ~16MB)\n• Formato não suportado\n• Problema de conectividade\n\n💡 *Soluções:*\n• Tente um vídeo menor\n• Use formato MP4\n• Verifique sua conexão'
                });
                return;
            }

            // Salva vídeo temporário
            const tempVideoPath = await this.saveTemporaryVideo(videoBuffer, userNumber);
            
            // Armazena informações do usuário aguardando escolha
            this.awaitingVideoPlacement.set(userNumber, {
                videoPath: tempVideoPath,
                timestamp: Date.now()
            });

            // Envia menu de escolha de local
            await this.sendVideoPlacementMenu(userNumber);

        } catch (error) {
            console.error('❌ Erro ao processar !uparvideo:', error);
            await this.sock.sendMessage(userNumber, {
                text: '❌ Erro interno. Tente novamente mais tarde.'
            });
        }
    }

    /**
     * Baixa o vídeo da mensagem
     */
    async downloadVideo(message) {
        try {
            console.log('🔄 Tentando baixar vídeo...');
            
            // Verifica se a mensagem tem vídeo
            const videoMessage = message.message.videoMessage;
            if (!videoMessage) {
                throw new Error('Mensagem não contém vídeo');
            }
            
            console.log('📱 Vídeo detectado, iniciando download...');
            
            // Tenta diferentes métodos de download baseados na versão do Baileys
            let buffer = null;
            
            // Método 1: downloadContentFromMessage (mais recente)
            if (downloadContentFromMessage) {
                console.log('🔄 Usando downloadContentFromMessage (import direto)...');
                const stream = await downloadContentFromMessage(videoMessage, 'video');
                
                // Converte stream para buffer
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                buffer = Buffer.concat(chunks);
                console.log(`✅ Download concluído: ${buffer.length} bytes`);
                
            } else if (typeof this.sock.downloadContentFromMessage === 'function') {
                console.log('🔄 Usando downloadContentFromMessage (método do socket)...');
                const stream = await this.sock.downloadContentFromMessage(videoMessage, 'video');
                
                // Converte stream para buffer
                const chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                buffer = Buffer.concat(chunks);
                console.log(`✅ Download concluído: ${buffer.length} bytes`);
                
            } else if (typeof this.sock.downloadMediaMessage === 'function') {
                // Método 2: downloadMediaMessage (versão anterior)
                console.log('🔄 Usando downloadMediaMessage...');
                buffer = await this.sock.downloadMediaMessage(message);
                console.log(`✅ Download concluído: ${buffer.length} bytes`);
                
            } else {
                throw new Error('Nenhum método de download disponível');
            }
            
            if (!buffer || buffer.length === 0) {
                throw new Error('Buffer vazio - download falhou');
            }
            
            return buffer;
            
        } catch (error) {
            console.error('❌ Erro ao baixar vídeo:', error);
            console.log('🔍 Métodos disponíveis:');
            console.log(`   downloadContentFromMessage (import): ${downloadContentFromMessage ? 'SIM' : 'NÃO'}`);
            console.log(`   downloadContentFromMessage (socket): ${typeof this.sock.downloadContentFromMessage === 'function' ? 'SIM' : 'NÃO'}`);
            console.log(`   downloadMediaMessage: ${typeof this.sock.downloadMediaMessage === 'function' ? 'SIM' : 'NÃO'}`);
            return null;
        }
    }

    /**
     * Salva vídeo temporário
     */
    async saveTemporaryVideo(videoBuffer, userNumber) {
        const fileName = `temp_${userNumber.replace(/[^0-9]/g, '')}_${Date.now()}.mp4`;
        const filePath = path.join(this.videosDir, fileName);
        
        fs.writeFileSync(filePath, videoBuffer);
        console.log(`💾 Vídeo temporário salvo: ${fileName}`);
        
        return filePath;
    }

    /**
     * Envia menu para escolher onde adicionar o vídeo
     */
    async sendVideoPlacementMenu(userNumber) {
        await this.sendTypingEffect(userNumber);
        
        const menuMessage = `🎥 *Vídeo recebido com sucesso!*

Onde você gostaria de adicionar este vídeo?

*1️⃣ Menu Principal (Boas-vindas)*
_O vídeo será enviado junto com o menu inicial_

*2️⃣ Seção Suporte*
_Vídeo será enviado na opção "Suporte 🌐"_

*3️⃣ Informações do Bot*
_Vídeo será enviado na opção "Informações Bot 🤖"_

*4️⃣ Nova Seção Personalizada*
_Criar nova opção no menu com este vídeo_

*5️⃣ Cancelar*
_Descartar este vídeo_

---
💡 _Digite o número da opção desejada (1-5)_`;

        await this.sock.sendMessage(userNumber, { text: menuMessage });
    }

    /**
     * Processa escolha de local do vídeo
     */
    async handleVideoPlacement(userNumber, option) {
        const userData = this.awaitingVideoPlacement.get(userNumber);
        if (!userData) {
            await this.sock.sendMessage(userNumber, {
                text: '❓ Não há vídeo pendente. Use !uparvideo em um vídeo primeiro.'
            });
            return;
        }

        // Remove da lista de espera
        this.awaitingVideoPlacement.delete(userNumber);

        await this.sendTypingEffect(userNumber);

        switch (option) {
            case '1':
                await this.addVideoToWelcome(userData.videoPath, userNumber);
                break;
            case '2':
                await this.addVideoToSupport(userData.videoPath, userNumber);
                break;
            case '3':
                await this.addVideoToBotInfo(userData.videoPath, userNumber);
                break;
            case '4':
                await this.createCustomVideoSection(userData.videoPath, userNumber);
                break;
            case '5':
                await this.cancelVideoUpload(userData.videoPath, userNumber);
                break;
            default:
                await this.sock.sendMessage(userNumber, {
                    text: '❓ Opção inválida. Vídeo descartado. Use !uparvideo novamente se necessário.'
                });
                this.deleteTemporaryVideo(userData.videoPath);
        }
    }

    /**
     * Adiciona vídeo ao menu principal
     */
    async addVideoToWelcome(videoPath, userNumber) {
        const finalPath = path.join(this.videosDir, 'welcome_video.mp4');
        
        // Remove vídeo anterior se existir
        if (this.videoConfig.welcome && fs.existsSync(this.videoConfig.welcome)) {
            fs.unlinkSync(this.videoConfig.welcome);
        }
        
        // Move vídeo para local final
        fs.renameSync(videoPath, finalPath);
        this.videoConfig.welcome = finalPath;
        this.saveVideoConfig();

        await this.sock.sendMessage(userNumber, {
            text: '✅ *Vídeo adicionado ao Menu Principal!*\n\n🎥 O vídeo será enviado automaticamente junto com as boas-vindas quando usuários digitarem "oi" ou "menu".\n\n💡 Teste digitando "menu" para verificar!'
        });

        console.log(`✅ Vídeo de boas-vindas atualizado por ${userNumber}`);
    }

    /**
     * Adiciona vídeo à seção suporte
     */
    async addVideoToSupport(videoPath, userNumber) {
        const finalPath = path.join(this.videosDir, 'suporte_video.mp4');
        
        if (this.videoConfig.suporte && fs.existsSync(this.videoConfig.suporte)) {
            fs.unlinkSync(this.videoConfig.suporte);
        }
        
        fs.renameSync(videoPath, finalPath);
        this.videoConfig.suporte = finalPath;
        this.saveVideoConfig();

        await this.sock.sendMessage(userNumber, {
            text: '✅ *Vídeo adicionado à Seção Suporte!*\n\n🎥 O vídeo será enviado quando usuários escolherem a opção "Suporte 🌐" (opção 1).\n\n💡 Teste digitando "1" para verificar!'
        });

        console.log(`✅ Vídeo de suporte atualizado por ${userNumber}`);
    }

    /**
     * Adiciona vídeo às informações do bot
     */
    async addVideoToBotInfo(videoPath, userNumber) {
        const finalPath = path.join(this.videosDir, 'info_bot_video.mp4');
        
        if (this.videoConfig.info_bot && fs.existsSync(this.videoConfig.info_bot)) {
            fs.unlinkSync(this.videoConfig.info_bot);
        }
        
        fs.renameSync(videoPath, finalPath);
        this.videoConfig.info_bot = finalPath;
        this.saveVideoConfig();

        await this.sock.sendMessage(userNumber, {
            text: '✅ *Vídeo adicionado às Informações do Bot!*\n\n🎥 O vídeo será enviado quando usuários escolherem a opção "Informações Bot 🤖" (opção 2).\n\n💡 Teste digitando "2" para verificar!'
        });

        console.log(`✅ Vídeo de info bot atualizado por ${userNumber}`);
    }

    /**
     * Cria seção personalizada com vídeo
     */
    async createCustomVideoSection(videoPath, userNumber) {
        await this.sendTypingEffect(userNumber, 1500);
        
        await this.sock.sendMessage(userNumber, {
            text: '🎯 *Criando Nova Seção Personalizada*\n\nDigite o nome/título para esta nova opção:\n\n💡 Exemplo: "Tutorial de Uso", "Promoções", "Novidades", etc.'
        });

        // Armazena dados para próxima resposta
        this.awaitingVideoPlacement.set(userNumber, {
            videoPath: videoPath,
            step: 'custom_name',
            timestamp: Date.now()
        });
    }

    /**
     * Processa nome da seção personalizada
     */
    async handleCustomSectionName(userNumber, sectionName) {
        const userData = this.awaitingVideoPlacement.get(userNumber);
        if (!userData || userData.step !== 'custom_name') {
            return false;
        }

        try {
            // Remove da lista de espera
            this.awaitingVideoPlacement.delete(userNumber);

            // Limpa nome da seção (remove caracteres especiais)
            const cleanSectionName = sectionName.replace(/[^a-zA-Z0-9\s]/g, '').trim();
            const sectionId = `custom_${Date.now()}`;
            
            // Salva vídeo da seção personalizada
            const finalPath = path.join(this.videosDir, `${sectionId}_video.mp4`);
            fs.renameSync(userData.videoPath, finalPath);

            // Adiciona à configuração
            if (!this.videoConfig.custom) {
                this.videoConfig.custom = [];
            }

            this.videoConfig.custom.push({
                id: sectionId,
                name: cleanSectionName,
                videoPath: finalPath,
                created: Date.now()
            });

            this.saveVideoConfig();

            await this.sendTypingEffect(userNumber, 2000);
            
            await this.sock.sendMessage(userNumber, {
                text: `✅ *Seção Personalizada Criada!*\n\n📝 **Nome:** ${cleanSectionName}\n🎥 **Vídeo:** Adicionado com sucesso\n🆔 **ID:** ${sectionId}\n\n💡 Esta seção será adicionada automaticamente ao menu principal em breve!\n\n🔄 Digite "menu" para testar o bot atualizado.`
            });

            console.log(`✅ Seção personalizada "${cleanSectionName}" criada por ${userNumber}`);
            return true;

        } catch (error) {
            console.error('❌ Erro ao criar seção personalizada:', error);
            await this.sock.sendMessage(userNumber, {
                text: '❌ Erro ao criar seção personalizada. Tente novamente.'
            });
            this.deleteTemporaryVideo(userData.videoPath);
            return false;
        }
    }

    /**
     * Obtém todas as seções personalizadas
     */
    getCustomSections() {
        return this.videoConfig.custom || [];
    }

    /**
     * Registra que usuário visitou uma etapa
     * @param {string} userNumber - Número do usuário
     * @param {string} stepId - ID da etapa visitada
     */
    trackUserNavigation(userNumber, stepId) {
        if (!this.videoConfig.userNavigation) {
            this.videoConfig.userNavigation = {};
        }
        
        if (!this.videoConfig.userNavigation[userNumber]) {
            this.videoConfig.userNavigation[userNumber] = {
                visited: [],
                lastVisit: Date.now()
            };
        }
        
        const userNav = this.videoConfig.userNavigation[userNumber];
        
        // Adiciona etapa se não foi visitada antes
        if (!userNav.visited.includes(stepId)) {
            userNav.visited.push(stepId);
            userNav.lastVisit = Date.now();
            this.saveVideoConfig();
            console.log(`📍 Usuário ${userNumber} visitou etapa: ${stepId}`);
        }
    }

    /**
     * Verifica se usuário já visitou uma etapa específica
     * @param {string} userNumber - Número do usuário
     * @param {string} stepId - ID da etapa
     * @returns {boolean}
     */
    hasUserVisited(userNumber, stepId) {
        const userNav = this.videoConfig.userNavigation?.[userNumber];
        return userNav ? userNav.visited.includes(stepId) : false;
    }

    /**
     * Obtém etapas disponíveis para um usuário específico
     * @param {string} userNumber - Número do usuário
     * @returns {Array} Lista de etapas disponíveis
     */
    getAvailableStepsForUser(userNumber) {
        const mainSteps = this.videoConfig.flow?.mainMenu || ['suporte', 'info_bot'];
        const conditionalSteps = this.videoConfig.flow?.conditional || {};
        
        const availableSteps = [...mainSteps];
        
        // Verifica etapas condicionais
        for (const [stepId, condition] of Object.entries(conditionalSteps)) {
            if (this.hasUserVisited(userNumber, condition.showAfter)) {
                availableSteps.push(stepId);
            }
        }
        
        return availableSteps;
    }

    /**
     * Adiciona etapa condicional
     * @param {string} stepId - ID da nova etapa
     * @param {string} showAfterStep - Etapa que deve ser visitada antes
     * @param {string} stepName - Nome da etapa
     * @param {string} videoPath - Caminho do vídeo (opcional)
     */
    addConditionalStep(stepId, showAfterStep, stepName, videoPath = null) {
        if (!this.videoConfig.flow) {
            this.videoConfig.flow = { mainMenu: ['suporte', 'info_bot'], conditional: {} };
        }
        
        if (!this.videoConfig.flow.conditional) {
            this.videoConfig.flow.conditional = {};
        }
        
        this.videoConfig.flow.conditional[stepId] = {
            showAfter: showAfterStep,
            name: stepName,
            videoPath: videoPath
        };
        
        // Adiciona legenda padrão se não existir
        if (!this.videoConfig.captions) {
            this.videoConfig.captions = {};
        }
        
        if (!this.videoConfig.captions[stepId]) {
            this.videoConfig.captions[stepId] = `🎥 *${stepName}*`;
        }
        
        this.saveVideoConfig();
        console.log(`✅ Etapa condicional '${stepName}' criada - aparece após '${showAfterStep}'`);
    }

    /**
     * Cancela upload do vídeo
     */
    async cancelVideoUpload(videoPath, userNumber) {
        this.deleteTemporaryVideo(videoPath);
        
        await this.sock.sendMessage(userNumber, {
            text: '❌ *Upload cancelado*\n\n🗑️ Vídeo descartado com sucesso.'
        });

        console.log(`🗑️ Upload de vídeo cancelado por ${userNumber}`);
    }

    /**
     * Remove vídeo temporário
     */
    deleteTemporaryVideo(videoPath) {
        try {
            if (fs.existsSync(videoPath)) {
                fs.unlinkSync(videoPath);
                console.log('🗑️ Vídeo temporário removido');
            }
        } catch (error) {
            console.error('❌ Erro ao remover vídeo temporário:', error);
        }
    }

    /**
     * Simula efeito de digitação
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
     * Verifica se usuário está aguardando escolha de vídeo
     */
    isAwaitingVideoPlacement(userNumber) {
        return this.awaitingVideoPlacement.has(userNumber);
    }

    /**
     * Define estado do usuário para fluxos de gerenciamento
     * @param {string} userNumber - Número do usuário
     * @param {string} state - Estado atual
     * @param {object} data - Dados adicionais
     */
    setUserState(userNumber, state, data = {}) {
        if (!this.videoConfig.userStates) {
            this.videoConfig.userStates = {};
        }
        
        this.videoConfig.userStates[userNumber] = {
            state: state,
            data: data,
            timestamp: Date.now()
        };
        
        console.log(`📍 Estado do usuário ${userNumber}: ${state}`);
    }

    /**
     * Obtém estado atual do usuário
     * @param {string} userNumber - Número do usuário
     * @returns {object|null}
     */
    getUserState(userNumber) {
        return this.videoConfig.userStates?.[userNumber] || null;
    }

    /**
     * Remove estado do usuário
     * @param {string} userNumber - Número do usuário
     */
    clearUserState(userNumber) {
        if (this.videoConfig.userStates && this.videoConfig.userStates[userNumber]) {
            delete this.videoConfig.userStates[userNumber];
            console.log(`🧹 Estado limpo para usuário ${userNumber}`);
        }
    }

    /**
     * Obtém vídeo configurado para uma seção
     */
    getVideoForSection(section) {
        return this.videoConfig[section] || null;
    }

    /**
     * Verifica se existe vídeo para uma seção
     */
    hasVideoForSection(section) {
        const videoPath = this.videoConfig[section];
        return videoPath && fs.existsSync(videoPath);
    }
}

module.exports = VideoHandler;