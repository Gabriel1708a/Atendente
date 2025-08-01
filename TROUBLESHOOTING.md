# 🔧 Guia de Solução de Problemas - Pareamento por Código

## 🚨 "Não foi possível conectar o dispositivo"

### Problema Mais Comum: Formato do Número

#### ✅ **SOLUÇÃO RÁPIDA:**
1. **Execute:** `npm run clear-session`
2. **Confirme:** Digite "SIM"
3. **Reinicie:** `npm start`
4. **Use seu número EXATO do WhatsApp**

#### 📱 **Como encontrar seu número correto:**
1. Abra WhatsApp no celular
2. Vá em **Configurações** → **Conta**
3. Copie o número EXATAMENTE como aparece
4. Use esse número no bot

### Formatos Aceitos vs Rejeitados

#### ✅ **FORMATOS CORRETOS:**
```
5511987654321   ← Recomendado (código país + ddd + número)
11987654321     ← Celular com 9º dígito
1133334444      ← Fixo sem 9º dígito
+5511987654321  ← Internacional (também funciona)
```

#### ❌ **FORMATOS INCORRETOS:**
```
987654321       ← Falta DDD
1187654321      ← Celular SEM 9º dígito
11987654321     ← Fixo COM 9º dígito (errado)
05511987654321  ← Zero à esquerda
```

## 🔍 Diagnóstico de Problemas

### Erro 401 - Não Autorizado
```
💡 CAUSA: Número não tem WhatsApp ou foi banido
🔧 SOLUÇÃO:
1. Verifique se o número tem WhatsApp ativo
2. Teste enviar uma mensagem para si mesmo
3. Se não funcionar, o número pode estar banido
```

### Erro 403 - Proibido
```
💡 CAUSA: Muitas tentativas de pareamento
🔧 SOLUÇÃO:
1. Aguarde 24 horas
2. Use QR Code como alternativa
3. Execute: npm run clear-session
```

### Erro 429 - Limite Excedido
```
💡 CAUSA: Muitas solicitações muito rápidas
🔧 SOLUÇÃO:
1. Aguarde 30 minutos
2. Tente novamente mais devagar
3. Use QR Code se urgente
```

### Socket não fica pronto
```
💡 CAUSA: Problema de conectividade ou versão Baileys
🔧 SOLUÇÃO:
1. Verifique sua internet
2. Execute: npm run clear-session
3. Reinicie o bot: npm start
4. Use QR Code se persistir
```

## 🛠️ Comandos de Manutenção

### Limpar Sessão (Resolve 90% dos problemas)
```bash
npm run clear-session
# ou
npm run reset
```

### Verificar Arquivos de Sessão
```bash
ls -la session/baileys_auth_info/
```

### Reset Manual Completo
```bash
rm -rf session/baileys_auth_info
npm start
```

## 📱 Problemas Específicos por Operadora

### Vivo/TIM/Claro
- ✅ Funcionam normalmente
- ✅ Use formato: 5511987654321

### Nextel
- ⚠️  Pode ter problemas com pareamento
- 💡 Use QR Code preferencialmente

### WhatsApp Business
- ✅ Funciona igual ao pessoal
- ✅ Use o número como aparece na conta Business

## 🎯 Passo a Passo Completo (Método que Funciona)

### 1. Reset Completo
```bash
npm run clear-session
```

### 2. Verificar Número no WhatsApp
- Configurações → Conta → Anotar número exato

### 3. Executar Bot
```bash
npm start
```

### 4. Escolher Método
- Digite **2** para código de pareamento
- OU digite **1** para QR Code (mais confiável)

### 5. Para Código de Pareamento
- Digite número EXATO: `5511987654321`
- Aguarde código aparecer
- No WhatsApp: Dispositivos conectados → Conectar com código
- Digite o código de 8 dígitos

### 6. Para QR Code (Mais Confiável)
- Escaneie o QR que aparece
- WhatsApp: Dispositivos conectados → Conectar dispositivo

## ⚡ Soluções Rápidas por Erro

| Erro | Solução Rápida |
|------|----------------|
| "Dispositivo não conecta" | `npm run reset` + QR Code |
| "Número inválido" | Verificar formato + reset |
| "Código não chega" | Aguardar 2 min + tentar QR |
| "Socket não pronto" | Reset + reiniciar bot |
| "401/403/429" | Aguardar + usar QR Code |

## 🆘 Se Nada Funcionar

### Método Garantido (QR Code)
1. `npm run clear-session`
2. `npm start`
3. Digite **1** (QR Code)
4. Escaneie com WhatsApp
5. ✅ Funcionará 100%

### Verificar Problema do Sistema
```bash
# Verificar versão Node.js (precisa ser 18+)
node --version

# Verificar versão Baileys
npm list @whiskeysockets/baileys

# Reinstalar dependências
rm -rf node_modules package-lock.json
npm install
```

## 📞 Últimos Recursos

1. **Use QR Code** - É o método mais confiável
2. **Aguarde 24h** - Se teve muitas tentativas
3. **Teste outro número** - Se possível
4. **Verifique internet** - Conexão estável é essencial

---

**💡 DICA FINAL:** O QR Code funciona em 99% dos casos. Se o pareamento por código não funcionar após seguir este guia, use o QR Code que é mais estável.