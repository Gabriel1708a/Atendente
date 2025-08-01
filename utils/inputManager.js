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
        console.log('⚠️  IMPORTANTE: Use o número EXATO como está registrado no WhatsApp');
        console.log('📋 Formatos aceitos para Brasil:');
        console.log('   • 5511987654321 (completo com código do país)');
        console.log('   • 11987654321 (celular com 9º dígito)');
        console.log('   • +5511987654321 (com + também funciona)');
        console.log('\n💡 Dicas importantes:');
        console.log('   • Para celular: DEVE ter o 9º dígito (11987654321)');
        console.log('   • Para fixo: sem o 9º dígito (1187654321)');
        console.log('   • Verifique se o número está ativo no WhatsApp');
        
        while (true) {
            const phoneNumber = await this.question('\n📞 Digite o número EXATO do WhatsApp: ');
            
            try {
                if (this.validatePhoneNumber(phoneNumber)) {
                    return this.formatPhoneNumber(phoneNumber);
                }
            } catch (error) {
                console.log(`❌ Erro: ${error.message}`);
            }
            
            console.log('\n❌ Número inválido ou formato incorreto');
            console.log('💡 Exemplos corretos:');
            console.log('   • 11987654321 (celular)');
            console.log('   • 5511987654321 (completo)');
            console.log('   • +5511987654321 (com +)');
            console.log('\n🔄 Tente novamente...');
        }
    }

    /**
     * Valida formato do número de telefone brasileiro
     * @param {string} phone - Número a ser validado
     * @returns {boolean} Se é válido
     */
    validatePhoneNumber(phone) {
        // Remove espaços e caracteres especiais
        const cleanPhone = phone.replace(/[\s\-\(\)\+]/g, '');
        
        console.log(`🔍 Validando número: ${phone} -> ${cleanPhone}`);
        
        // Verifica se contém apenas números
        if (!/^\d+$/.test(cleanPhone)) {
            console.log('❌ Número contém caracteres inválidos');
            return false;
        }
        
        // Verifica formatos brasileiros válidos
        const validFormats = [
            /^55\d{2}9\d{8}$/, // 5511987654321 (formato completo com 9)
            /^55\d{2}[6-9]\d{7}$/, // 5511987654321 (fixo)
            /^\d{2}9\d{8}$/, // 11987654321 (celular com 9)
            /^\d{2}[6-9]\d{7}$/, // 1187654321 (fixo local)
        ];
        
        const isValid = validFormats.some(regex => regex.test(cleanPhone));
        
        if (isValid) {
            console.log('✅ Número válido');
        } else {
            console.log('❌ Número não atende aos formatos brasileiros válidos');
            console.log('Formatos aceitos:');
            console.log('- 5511987654321 (completo)');
            console.log('- 11987654321 (celular)');
            console.log('- 1187654321 (fixo)');
        }
        
        return isValid;
    }

    /**
     * Formata número de telefone para o padrão do WhatsApp Baileys
     * @param {string} phone - Número a ser formatado
     * @returns {string} Número formatado para Baileys
     */
    formatPhoneNumber(phone) {
        // Remove tudo exceto números
        let cleanPhone = phone.replace(/[^\d]/g, '');
        
        console.log(`🔍 Número original: ${phone}`);
        console.log(`🔍 Número limpo: ${cleanPhone}`);
        
        // Se não começar com código do país, assume Brasil (55)
        if (!cleanPhone.startsWith('55')) {
            if (cleanPhone.length === 11) {
                // Número brasileiro com 11 dígitos (11987654321)
                cleanPhone = '55' + cleanPhone;
            } else if (cleanPhone.length === 10) {
                // Número brasileiro com 10 dígitos (1187654321) - adiciona 9
                cleanPhone = '55' + cleanPhone.substring(0, 2) + '9' + cleanPhone.substring(2);
            }
        }
        
        // Valida se tem pelo menos 12 dígitos (país + ddd + número)
        if (cleanPhone.length < 12) {
            throw new Error(`Número muito curto: ${cleanPhone}. Precisa ter pelo menos 12 dígitos.`);
        }
        
        console.log(`🔍 Número final formatado: ${cleanPhone}`);
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