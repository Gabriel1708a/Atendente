# 🤖 Bot de Atendimento WhatsApp - Baileys

Bot automatizado para atendimento ao cliente no WhatsApp, desenvolvido com a biblioteca Baileys. Oferece menu interativo com botões para facilitar a navegação dos usuários.

## 🚀 Funcionalidades

- ✅ **Menu Interativo**: Botões clicáveis para navegação
- ✅ **Ativação por Comando**: Responde a "oi" ou "menu"
- ✅ **Suporte Personalizado**: Direciona para contato humano
- ✅ **Informações do Bot**: Exibe detalhes técnicos
- ✅ **Sessão Persistente**: Não requer QR code a cada uso
- ✅ **Reconexão Automática**: Recupera conexão automaticamente
- ✅ **Interface Amigável**: QR code customizado no terminal

## 📁 Estrutura do Projeto

```
whatsapp-bot-baileys/
├── 📄 index.js                 # Arquivo principal
├── 📄 package.json            # Dependências do projeto
├── 📄 README.md               # Documentação
├── 📁 handlers/               # Handlers modulares
│   └── 📄 messageHandler.js   # Processamento de mensagens
├── 📁 session/                # Gerenciamento de sessão
│   ├── 📄 auth.js            # Autenticação
│   └── 📁 baileys_auth_info/ # Dados de sessão (criado automaticamente)
```

## 🛠️ Tecnologias Utilizadas

- **Node.js** 18+
- **@whiskeysockets/baileys** - Biblioteca WhatsApp Web
- **qrcode-terminal** - Exibição de QR code
- **pino** - Sistema de logs

## 📦 Instalação

### 1. Clone o repositório ou crie os arquivos

```bash
# Se clonar um repositório
git clone <seu-repositorio>
cd whatsapp-bot-baileys

# Ou crie a estrutura manualmente conforme documentação
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Execute o bot

```bash
npm start
```

## 🔧 Como Usar

### Primeira Execução

1. Execute `npm start`
2. Um QR code será exibido no terminal
3. Escaneie com seu WhatsApp:
   - Abra WhatsApp > Menu > Dispositivos conectados
   - Toque em "Conectar um dispositivo" 
   - Escaneie o QR code

### Execuções Seguintes

O bot se conectará automaticamente usando a sessão salva, sem necessidade de QR code.

### Testando o Bot

1. Envie "**oi**" ou "**menu**" para o número conectado
2. O bot responderá com um menu interativo
3. Clique nos botões:
   - **Suporte 🌐**: Direciona para atendimento humano
   - **Informações Bot 🤖**: Mostra detalhes técnicos

## 🎯 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `oi` ou `menu` | Exibe menu principal com botões |
| Botão "Suporte 🌐" | Informações de contato do suporte |
| Botão "Informações Bot 🤖" | Detalhes técnicos do bot |

## ⚙️ Personalização

### Modificar Mensagens

Edite o arquivo `handlers/messageHandler.js`:

- **Mensagem de boas-vindas**: Linha ~70
- **Informações de suporte**: Linha ~125  
- **Informações do bot**: Linha ~140

### Adicionar Novos Botões

1. Adicione novo botão no array `buttons` (linha ~80)
2. Adicione case correspondente no `switch` (linha ~120)

### Configurar Suporte

Substitua o número de exemplo na linha ~131:
```javascript
📱 wa.me/5599999999999  // Substitua pelo seu número
```

## 🔄 Scripts Disponíveis

```bash
npm start     # Inicia o bot
npm run dev   # Executa com nodemon (reinicia automaticamente)
```

## 🚨 Solução de Problemas

### Bot não conecta
- Verifique sua conexão com a internet
- Certifique-se que o Node.js 18+ está instalado
- Tente remover a pasta `session/baileys_auth_info` e refazer QR

### Botões não funcionam
- Alguns clientes WhatsApp podem não suportar botões
- O bot possui fallback para texto simples

### Erro de dependências
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📋 Logs do Sistema

O bot exibe logs coloridos no terminal:
- 🚀 Inicialização
- 📱 QR Code
- ✅ Conexão estabelecida  
- 📩 Mensagens recebidas
- 🔘 Botões clicados
- ❌ Erros

## 🔒 Segurança

- Dados de sessão são armazenados localmente
- Não compartilhe a pasta `session/`
- Use em ambiente seguro

## 📝 Notas Importantes

- O bot funciona como um cliente WhatsApp Web
- Mantenha o terminal aberto enquanto o bot estiver ativo
- A sessão expira se ficar muito tempo offline
- Para produção, considere usar PM2 ou similar

## 🤝 Contribuição

Sinta-se à vontade para contribuir com melhorias:
1. Fork o projeto
2. Crie uma branch para sua feature
3. Faça commit das mudanças
4. Abra um Pull Request

## 📄 Licença

MIT License - Veja o arquivo LICENSE para detalhes.

---

**Desenvolvido com ❤️ usando Baileys WhatsApp Library**