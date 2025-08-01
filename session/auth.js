const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const path = require('path');

/**
 * Módulo para gerenciar autenticação e sessão persistente
 */
class AuthManager {
    constructor() {
        this.sessionPath = path.join(__dirname, 'baileys_auth_info');
        this.connectionMethod = null; // 'qr' ou 'code'
        this.phoneNumber = null; // Número para pareamento
    }

    /**
     * Carrega ou cria estado de autenticação
     * @returns {Promise<Object>} Estado de autenticação
     */
    async loadAuthState() {
        try {
            console.log('🔐 Carregando estado de autenticação...');
            const { state, saveCreds } = await useMultiFileAuthState(this.sessionPath);
            
            console.log('✅ Estado de autenticação carregado com sucesso!');
            return { state, saveCreds };
            
        } catch (error) {
            console.error('❌ Erro ao carregar estado de autenticação:', error);
            throw error;
        }
    }

    /**
     * Verifica se existe sessão salva
     * @returns {boolean}
     */
    hasExistingSession() {
        const fs = require('fs');
        const sessionExists = fs.existsSync(this.sessionPath);
        
        if (sessionExists) {
            console.log('📁 Sessão existente encontrada!');
        } else {
            console.log('🆕 Primeira execução - nova sessão será criada');
        }
        
        return sessionExists;
    }

    /**
     * Remove sessão existente (útil para reset)
     */
    clearSession() {
        const fs = require('fs');
        try {
            if (fs.existsSync(this.sessionPath)) {
                fs.rmSync(this.sessionPath, { recursive: true, force: true });
                console.log('🗑️ Sessão removida com sucesso!');
            }
        } catch (error) {
            console.error('❌ Erro ao remover sessão:', error);
        }
    }

    /**
     * Define método de conexão
     * @param {string} method - 'qr' ou 'code'
     */
    setConnectionMethod(method) {
        this.connectionMethod = method;
    }

    /**
     * Define número para pareamento
     * @param {string} phoneNumber - Número formatado
     */
    setPhoneNumber(phoneNumber) {
        this.phoneNumber = phoneNumber;
    }

    /**
     * Obtém método de conexão atual
     * @returns {string} Método de conexão
     */
    getConnectionMethod() {
        return this.connectionMethod;
    }

    /**
     * Obtém número para pareamento
     * @returns {string} Número de telefone
     */
    getPhoneNumber() {
        return this.phoneNumber;
    }
}

module.exports = AuthManager;