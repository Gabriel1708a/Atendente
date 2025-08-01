#!/usr/bin/env node

const SessionManager = require('../utils/sessionManager');

console.log('🔧 LIMPADOR DE SESSÃO DO BOT WHATSAPP\n');

const sessionManager = new SessionManager();

// Verifica se existe sessão
if (!sessionManager.hasSession()) {
    console.log('ℹ️  Nenhuma sessão encontrada.');
    console.log('O bot já está pronto para uma nova conexão.');
    process.exit(0);
}

// Exibe informações da sessão atual
console.log('📊 SESSÃO ATUAL ENCONTRADA:');
sessionManager.displaySessionStatus();

console.log('\n⚠️  IMPORTANTE:');
console.log('• Isso irá remover COMPLETAMENTE a sessão atual');
console.log('• Você precisará conectar novamente (QR ou código)');
console.log('• Todos os dados de autenticação serão perdidos');

// Pergunta confirmação
const readline = require('readline');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

rl.question('\n❓ Deseja continuar? (digite "SIM" para confirmar): ', (answer) => {
    rl.close();
    
    if (answer.toUpperCase() === 'SIM') {
        console.log('\n🔄 Removendo sessão...');
        
        if (sessionManager.clearSession()) {
            console.log('\n✅ SESSÃO REMOVIDA COM SUCESSO!');
            console.log('\n🚀 Próximos passos:');
            console.log('1. Execute: npm start');
            console.log('2. Escolha método de conexão (QR ou código)');
            console.log('3. Complete a autenticação');
            console.log('\n💡 Dica: Se o pareamento por código ainda não funcionar,');
            console.log('   use o QR Code (opção 1) que é mais confiável.');
        } else {
            console.log('\n❌ Erro ao remover sessão');
            process.exit(1);
        }
    } else {
        console.log('\n❌ Operação cancelada');
        console.log('A sessão atual foi mantida');
    }
});