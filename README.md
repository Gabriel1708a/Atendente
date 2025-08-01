# 🤖 Bot de Atendimento WhatsApp - Baileys

Bot automatizado para atendimento ao cliente no WhatsApp, desenvolvido com a biblioteca Baileys. Oferece menu interativo com botões para facilitar a navegação dos usuários.

## 🚀 Funcionalidades

- ✅ **Menu Interativo**: Botões clicáveis para navegação
- ✅ **Ativação por Comando**: Responde a "oi" ou "menu"
- ✅ **Suporte Personalizado**: Direciona para contato humano
- ✅ **Informações do Bot**: Exibe detalhes técnicos
- ✅ **Sistema de Vídeos**: Comando !uparvideo para adicionar vídeos
- ✅ **Efeito de Digitação**: Bot simula digitação realista
- ✅ **Seções Personalizadas**: Crie novas opções com vídeos
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
│   ├── 📄 messageHandler.js   # Processamento de mensagens
│   └── 📄 videoHandler.js     # Gerenciamento de vídeos
├── 📁 session/                # Gerenciamento de sessão
│   ├── 📄 auth.js            # Autenticação
│   └── 📁 baileys_auth_info/ # Dados de sessão (criado automaticamente)
├── 📁 videos/                 # Armazenamento de vídeos (criado automaticamente)
│   └── 📄 videos-config.json  # Configuração de vídeos
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
2. O bot tentará enviar menu interativo (com fallback automático):
   - **Lista Interativa** (mais moderna)
   - **Botões Tradicionais** (se lista falhar)
   - **Menu Numerado** (fallback final)
3. Interaja com as opções:
   - **Suporte 🌐** ou digite **1**: Direciona para atendimento humano
   - **Informações Bot 🤖** ou digite **2**: Mostra detalhes técnicos

## 🎯 Comandos Disponíveis

| Comando | Descrição |
|---------|-----------|
| `oi` ou `menu` | Exibe menu principal interativo |
| `1` | Acesso rápido ao suporte |
| `2` | Acesso rápido às informações do bot |
| `!uparvideo` | Adiciona vídeo ao bot (envie na legenda do vídeo) |
| Botão/Lista "Suporte 🌐" | Informações de contato do suporte |
| Botão/Lista "Informações Bot 🤖" | Detalhes técnicos do bot |

## 🎥 Sistema de Vídeos

### Como Usar o Comando !uparvideo

1. **Grave ou selecione um vídeo**
2. **Adicione `!uparvideo` na legenda** do vídeo
3. **Envie o vídeo** para o bot
4. **Escolha onde adicionar:**
   - Menu Principal (boas-vindas)
   - Seção Suporte
   - Informações do Bot
   - Nova Seção Personalizada
5. **Pronto!** O vídeo será enviado automaticamente

### Funcionalidades dos Vídeos

- ✅ **Integração Automática**: Vídeos são enviados junto com as respostas
- ✅ **Efeito de Digitação**: Bot simula digitação antes de enviar
- ✅ **Múltiplas Seções**: Adicione vídeos em qualquer parte do bot
- ✅ **Seções Personalizadas**: Crie novas opções no menu
- ✅ **Substituição Inteligente**: Vídeos antigos são substituídos automaticamente

## ⚙️ Personalização

### Modificar Mensagens

Edite o arquivo `handlers/messageHandler.js`:

- **Mensagem de boas-vindas**: Linha ~110
- **Informações de suporte**: Linha ~180
- **Informações do bot**: Linha ~200

### Gerenciar Vídeos

Os vídeos são armazenados em `videos/` e configurados em `videos/videos-config.json`:

- **Vídeo de boas-vindas**: `welcome_video.mp4`
- **Vídeo de suporte**: `suporte_video.mp4`
- **Vídeo do bot**: `info_bot_video.mp4`
- **Vídeos personalizados**: `custom_[timestamp]_video.mp4`

### Configurar Suporte

Substitua o número de exemplo na linha ~180:
```javascript
📱 wa.me/5599999999999  // Substitua pelo seu número
```

### Personalizar Efeito de Digitação

Edite durações no `messageHandler.js`:
```javascript
await this.sendTypingEffect(userNumber, 2000); // 2 segundos
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
- O bot usa sistema de fallback automático: Lista → Botões → Números
- Se nenhum funcionar, digite números (1 ou 2) diretamente
- Todos os clientes WhatsApp suportam o modo numerado

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