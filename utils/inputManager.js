const readline = require('readline');

/**
 * Gerenciador de entrada do usuário via terminal
 */
class InputManager {
    constructor() {
        this.rl = null;
    }

    /**
     * Cria interface readline
     */
    createInterface() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    /**
     * Fecha interface readline
     */
    closeInterface() {
        if (this.rl) {
            this.rl.close();
            this.rl = null;
        }
    }

    /**
     * Pergunta ao usuário e retorna resposta
     * @param {string} question - Pergunta a ser feita
     * @returns {Promise<string>} Resposta do usuário
     */
    async question(question) {
        if (!this.rl) {
            this.createInterface();
        }

        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    /**
     * Pergunta método de conexão preferido
     * @returns {Promise<string>} 'qr' ou 'code'
     */
    async askConnectionMethod() {
        console.log('\n🔐 MÉTODO DE CONEXÃO\n');
        console.log('Escolha como deseja conectar o bot:');
        console.log('1️⃣  QR Code (método tradicional)');
        console.log('2️⃣  Código de Pareamento (mais prático)');
        
        while (true) {
            const choice = await this.question('\n💡 Digite 1 para QR Code ou 2 para Código de Pareamento: ');
            
            if (choice === '1') {
                return 'qr';
            } else if (choice === '2') {
                return 'code';
            } else {
                console.log('❌ Opção inválida. Digite 1 ou 2.');
            }
        }
    }

    /**
     * Solicita número de telefone para pareamento
     * @returns {Promise<string>} Número formatado
     */
    async askPhoneNumber() {
        console.log('\n📱 NÚMERO DO BOT\n');
        console.log('Digite o número que será usado como bot.');
        console.log('📋 Formato aceito: +5511999999999 ou 5511999999999');
        console.log('🌍 Inclua o código do país (Brasil: +55)');
        
        while (true) {
            const phoneNumber = await this.question('\n📞 Digite o número do WhatsApp: ');
            
            if (this.validatePhoneNumber(phoneNumber)) {
                return this.formatPhoneNumber(phoneNumber);
            } else {
                console.log('❌ Número inválido. Use o formato: +5511999999999');
                console.log('💡 Exemplo: +5511987654321');
            }
        }
    }

    /**
     * Valida formato do número de telefone
     * @param {string} phone - Número a ser validado
     * @returns {boolean} Se é válido
     */
    validatePhoneNumber(phone) {
        // Remove espaços e caracteres especiais
        const cleanPhone = phone.replace(/[\s\-\(\)]/g, '');
        
        // Verifica se tem pelo menos 10 dígitos (código país + número)
        // e se contém apenas números e opcionalmente +
        const phoneRegex = /^\+?[1-9]\d{9,14}$/;
        
        return phoneRegex.test(cleanPhone);
    }

    /**
     * Formata número de telefone para o padrão do WhatsApp
     * @param {string} phone - Número a ser formatado
     * @returns {string} Número formatado
     */
    formatPhoneNumber(phone) {
        // Remove tudo exceto números
        let cleanPhone = phone.replace(/[^\d]/g, '');
        
        // Se não começar com código do país, assume Brasil (55)
        if (!cleanPhone.startsWith('55') && cleanPhone.length === 11) {
            cleanPhone = '55' + cleanPhone;
        }
        
        // Remove o + se existir e readiciona
        return cleanPhone;
    }

    /**
     * Mostra loading enquanto aguarda código
     */
    showPairingWait() {
        console.log('\n⏳ AGUARDANDO CÓDIGO DE PAREAMENTO...\n');
        console.log('📱 Verifique seu WhatsApp!');
        console.log('💬 Um código de 8 dígitos será enviado para você.');
        console.log('🔄 Aguarde alguns segundos...\n');
    }

    /**
     * Mostra sucesso do pareamento
     * @param {string} phoneNumber - Número que foi pareado
     */
    showPairingSuccess(phoneNumber) {
        console.log('✅ CÓDIGO DE PAREAMENTO ENVIADO!\n');
        console.log(`📱 Número: +${phoneNumber}`);
        console.log('💬 Verifique suas mensagens do WhatsApp');
        console.log('🔢 Digite o código de 8 dígitos que você recebeu');
        console.log('⏰ O código expira em alguns minutos\n');
    }

    /**
     * Mostra erro de pareamento
     * @param {string} error - Mensagem de erro
     */
    showPairingError(error) {
        console.log('❌ ERRO NO PAREAMENTO\n');
        console.log(`🚫 ${error}`);
        console.log('\n💡 Dicas:');
        console.log('• Verifique se o número está correto');
        console.log('• Certifique-se que o WhatsApp está instalado');
        console.log('• Tente novamente em alguns minutos\n');
    }
}

module.exports = InputManager;