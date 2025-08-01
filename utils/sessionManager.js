const fs = require('fs');
const path = require('path');

/**
 * Utilitário para gerenciar sessões do bot
 */
class SessionManager {
    constructor() {
        this.sessionPath = path.join(__dirname, '..', 'session', 'baileys_auth_info');
    }

    /**
     * Verifica se existe sessão
     */
    hasSession() {
        return fs.existsSync(this.sessionPath);
    }

    /**
     * Remove sessão completamente
     */
    clearSession() {
        try {
            if (fs.existsSync(this.sessionPath)) {
                fs.rmSync(this.sessionPath, { recursive: true, force: true });
                console.log('✅ Sessão removida com sucesso!');
                return true;
            } else {
                console.log('ℹ️  Nenhuma sessão encontrada para remover.');
                return false;
            }
        } catch (error) {
            console.error('❌ Erro ao remover sessão:', error);
            return false;
        }
    }

    /**
     * Obtém informações da sessão
     */
    getSessionInfo() {
        if (!this.hasSession()) {
            return null;
        }

        try {
            const stats = fs.statSync(this.sessionPath);
            const files = fs.readdirSync(this.sessionPath);
            
            return {
                created: stats.birthtime,
                modified: stats.mtime,
                files: files.length,
                size: this.getDirectorySize(this.sessionPath)
            };
        } catch (error) {
            console.error('❌ Erro ao obter info da sessão:', error);
            return null;
        }
    }

    /**
     * Calcula tamanho do diretório
     */
    getDirectorySize(dirPath) {
        let size = 0;
        try {
            const files = fs.readdirSync(dirPath);
            for (const file of files) {
                const filePath = path.join(dirPath, file);
                const stats = fs.statSync(filePath);
                if (stats.isDirectory()) {
                    size += this.getDirectorySize(filePath);
                } else {
                    size += stats.size;
                }
            }
        } catch (error) {
            // Ignora erros
        }
        return size;
    }

    /**
     * Formata tamanho em bytes para leitura humana
     */
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Exibe status da sessão
     */
    displaySessionStatus() {
        const info = this.getSessionInfo();
        
        if (!info) {
            console.log('📊 STATUS DA SESSÃO: Nenhuma sessão encontrada');
            return;
        }

        console.log('📊 STATUS DA SESSÃO:');
        console.log(`   📅 Criada: ${info.created.toLocaleString()}`);
        console.log(`   🔄 Modificada: ${info.modified.toLocaleString()}`);
        console.log(`   📁 Arquivos: ${info.files}`);
        console.log(`   💾 Tamanho: ${this.formatBytes(info.size)}`);
    }

    /**
     * Backup da sessão atual
     */
    backupSession() {
        if (!this.hasSession()) {
            console.log('❌ Nenhuma sessão para fazer backup');
            return false;
        }

        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(__dirname, '..', 'session', `backup_${timestamp}`);
            
            this.copyDirectory(this.sessionPath, backupPath);
            console.log(`✅ Backup criado: ${backupPath}`);
            return true;
        } catch (error) {
            console.error('❌ Erro ao criar backup:', error);
            return false;
        }
    }

    /**
     * Copia diretório recursivamente
     */
    copyDirectory(src, dest) {
        fs.mkdirSync(dest, { recursive: true });
        const files = fs.readdirSync(src);
        
        for (const file of files) {
            const srcPath = path.join(src, file);
            const destPath = path.join(dest, file);
            const stats = fs.statSync(srcPath);
            
            if (stats.isDirectory()) {
                this.copyDirectory(srcPath, destPath);
            } else {
                fs.copyFileSync(srcPath, destPath);
            }
        }
    }

    /**
     * Menu interativo para gerenciar sessão
     */
    async interactiveMenu() {
        const InputManager = require('./inputManager');
        const input = new InputManager();
        
        console.log('\n🔧 GERENCIADOR DE SESSÃO\n');
        this.displaySessionStatus();
        
        console.log('\n📋 OPÇÕES DISPONÍVEIS:');
        console.log('1 - Exibir informações da sessão');
        console.log('2 - Fazer backup da sessão');
        console.log('3 - Limpar sessão (reset completo)');
        console.log('4 - Voltar');
        
        const choice = await input.question('\n🎯 Escolha uma opção (1-4): ');
        input.closeInterface();
        
        switch(choice) {
            case '1':
                this.displaySessionStatus();
                break;
            case '2':
                this.backupSession();
                break;
            case '3':
                console.log('\n⚠️  ATENÇÃO: Isso irá remover a sessão atual.');
                console.log('Você precisará escanear QR code ou usar pareamento novamente.');
                
                const confirm = await input.question('Confirma? (s/n): ');
                input.closeInterface();
                
                if (confirm.toLowerCase() === 's' || confirm.toLowerCase() === 'sim') {
                    this.clearSession();
                } else {
                    console.log('❌ Operação cancelada.');
                }
                break;
            case '4':
            default:
                console.log('👋 Voltando...');
        }
    }
}

module.exports = SessionManager;