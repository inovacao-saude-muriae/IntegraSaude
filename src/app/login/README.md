# 📁 `/src/app/login` - Página de Login

Página de autenticação do sistema. Primeira tela que o usuário vê ao acessar o IntegraSaude.

**Rota:** `/login`  
**Acesso:** Público (não requer autenticação)

---

## 📄 Arquivos Nesta Pasta

### `page.js`
**Tipo:** Client Component (`'use client'`)  
**Função:** Formulário de login e lógica de autenticação

#### O Que Este Arquivo Faz

**1. Declaração do Client Component**
```javascript
'use client';
```
- **Por quê?** Usa hooks do React (`useState`) e eventos do navegador
- Client Components podem ter interatividade
- Renderiza no navegador, não no servidor

**2. Imports**
```javascript
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { loginAction } from '@/app/actions/auth';
import styles from './LoginPage.module.css';
```
- `useState`: Gerenciar mensagens de erro e estado de loading
- `useRouter`: Navegar após login bem-sucedido
- `loginAction`: Server Action que valida credenciais
- `styles`: CSS Modules para estilização

**3. Estados do Componente**
```javascript
const [msg, setMsg] = useState('');
const [loading, setLoading] = useState(false);
```
- `msg`: Mensagem de erro (ex: "CPF ou senha incorretos")
- `loading`: Indica se está processando login
  - `false`: Botão "Entrar no Sistema"
  - `true`: Botão "Acessando..." (desabilitado)

**4. Função de Redirecionamento por Role**
```javascript
const getDestinationByRole = (role) => {
  switch (role) {
    case 'ADMIN':
    case 'GESTOR':
      return '/';
    
    case 'OPERADOR_REGULA':
    case 'ADMIN_REGULA':
      return '/regulacao?tab=DASHBOARD';
    
    // ... outros casos
  }
}
```

**Propósito:**
- Cada cargo vai para seu módulo específico após login
- Melhora UX: usuário não precisa navegar manualmente

**Mapeamento:**
| Role | Destino | Motivo |
|------|---------|--------|
| `GESTOR`, `ADMIN` | `/` | Dashboard geral (acesso total) |
| `REGULACAO_ADMIN`, `OPERADOR_REGULA` | `/regulacao?tab=DASHBOARD` | Módulo Regulação |
| `FARMACIA_ADMIN`, `OPERADOR_FARMACIA` | `/camara-tecnica/farmacia-judicial` | Módulo Farmácia |
| `PROCESSO_ADMIN` | `/camara-tecnica/processos` | Módulo Processos |
| `JUNTA_ADMIN`, `OPERADOR_JUNTA` | `/junta-reguladora?tab=CADASTRO` | Módulo Junta |
| `VETERINARIO`, `OPERADOR_CCZ` | `/ccz?tab=DASHBOARD` | Módulo CCZ |
| Outros | `/regulacao` | Padrão (fallback) |

**5. Função de Submit (Lógica Principal)**
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();  // Previne reload da página
  setMsg('');          // Limpa mensagem anterior
  setLoading(true);    // Mostra "Acessando..."

  const formData = new FormData(e.target);  // Coleta dados do form
  const res = await loginAction(formData);   // Chama Server Action
  
  if (res?.success) {
    // ✅ Login bem-sucedido
  } else {
    // ❌ Falha no login
  }
}
```

**Passo a passo do que acontece:**

**A. Prevenir Reload**
```javascript
e.preventDefault();
```
- Sem isso: formulário recarrega a página (comportamento padrão)
- Com isso: JavaScript controla o envio

**B. Preparar UI**
```javascript
setMsg('');        // Remove mensagem de erro anterior
setLoading(true);  // Desabilita botão, mostra "Acessando..."
```

**C. Coletar Dados**
```javascript
const formData = new FormData(e.target);
```
- Captura valores dos inputs `<input name="cpf">` e `<input name="senha">`
- Cria objeto FormData com: `{ cpf: "12345678900", senha: "minhasenha" }`

**D. Chamar Server Action**
```javascript
const res = await loginAction(formData);
```
- Envia dados para `src/app/actions/auth.js`
- Server Action valida CPF, senha, e cria JWT
- Retorna `{ success: true, role: "GESTOR" }` ou `{ error: "..." }`

**E. Processar Resposta (Sucesso)**
```javascript
if (res?.success) {
  // 1. Salvar CPF no localStorage (para recuperar depois)
  const cpfDigitado = formData.get('cpf')?.replace(/\D/g, '');
  localStorage.setItem('user_cpf', cpfDigitado);
  
  // 2. Forçar Next.js a reconhecer novo cookie
  router.refresh();
  
  // 3. Redirecionar para módulo do usuário
  const destination = getDestinationByRole(res.role);
  router.push(destination);
}
```

**F. Processar Resposta (Falha)**
```javascript
else {
  setMsg(res?.error || 'CPF ou senha incorretos.');
  setLoading(false);  // Re-habilita botão
}
```

**6. JSX (Interface do Usuário)**

**A. Estrutura da Página**
```javascript
<div className={styles.pageWrapper}>       {/* Container tela inteira */}
  <header className={styles.loginHeader}>  {/* Header fixo */}
    {/* Logo + Badge */}
  </header>
  
  <main className={styles.mainContent}>    {/* Área centralizada */}
    <form onSubmit={handleSubmit}>         {/* Formulário */}
      {/* Campos e botão */}
    </form>
  </main>
</div>
```

**B. Header**
```javascript
<header className={styles.loginHeader}>
  <div className={styles.brand}>
    {/* SVG do logo (4 quadrados) */}
    <span>IntegraSaude</span>
  </div>
  <span className={styles.badge}>Acesso Restrito</span>
</header>
```
- **Brand:** Logo + Nome do sistema
- **Badge:** Indica que é área restrita

**C. Formulário**
```javascript
<form onSubmit={handleSubmit} className={styles.card}>
  <h2>Identifique-se</h2>
  
  {msg && <div className={styles.errorMessage}>{msg}</div>}
  
  <div className={styles.inputGroup}>
    <label>CPF:</label>
    <input type="text" name="cpf" required placeholder="Digite seu CPF" />
  </div>
  
  <div className={styles.inputGroupLast}>
    <label>Senha:</label>
    <input type="password" name="senha" required placeholder="Digite sua senha" />
  </div>
  
  <button type="submit" disabled={loading}>
    {loading ? 'Acessando...' : 'Entrar no Sistema'}
  </button>
</form>
```

**Campos:**
- **CPF:** `<input type="text" name="cpf" required>`
  - Tipo texto (não validação nativa de CPF)
  - Obrigatório (`required`)
  - Name: "cpf" (Server Action lê como `formData.get('cpf')`)
  
- **Senha:** `<input type="password" name="senha" required>`
  - Tipo password (esconde caracteres)
  - Obrigatório (`required`)
  - Name: "senha"

**Botão:**
```javascript
<button 
  type="submit" 
  disabled={loading}
  className={loading ? styles.buttonDisabled : ''}
>
  {loading ? 'Acessando...' : 'Entrar no Sistema'}
</button>
```
- Desabilitado quando `loading === true`
- Texto muda dinamicamente
- Previne múltiplos cliques

---

#### Fluxo Completo de Login

```
1. Usuário acessa /login
   ↓
2. Vê formulário (CPF + Senha)
   ↓
3. Preenche:
   - CPF: 12912453674
   - Senha: regula@saude_2026
   ↓
4. Clica "Entrar no Sistema"
   ↓
5. handleSubmit() é executado
   ↓
6. Coleta formData
   ↓
7. loginAction(formData) é chamado
   ↓
8. Server Action valida:
   - ✅ CPF existe no banco
   - ✅ Senha correta (bcrypt)
   - ✅ Usuário ativo
   ↓
9. Server Action cria JWT e cookie
   ↓
10. Retorna { success: true, role: "GESTOR" }
   ↓
11. CPF salvo no localStorage
   ↓
12. router.refresh() (atualiza cache)
   ↓
13. getDestinationByRole("GESTOR") → "/"
   ↓
14. router.push("/")
   ↓
15. Middleware valida JWT
   ↓
16. Usuário vê Dashboard (logado)
```

---

#### Tratamento de Erros

**Erro 1: CPF Inválido**
```javascript
// Server Action retorna:
{ error: "Informe um CPF válido com 11 dígitos." }

// Interface mostra:
┌─────────────────────────────┐
│ ⚠️ Informe um CPF válido    │
│    com 11 dígitos.          │
└─────────────────────────────┘
```

**Erro 2: Senha Incorreta**
```javascript
// Server Action retorna:
{ error: "Senha incorreta. Tente novamente." }

// Interface mostra:
┌─────────────────────────────┐
│ ⚠️ Senha incorreta.         │
│    Tente novamente.         │
└─────────────────────────────┘
```

**Erro 3: Usuário Inativo**
```javascript
// Server Action retorna:
{ error: "Usuário não encontrado ou inativo no sistema." }

// Interface mostra:
┌─────────────────────────────────────────┐
│ ⚠️ Usuário não encontrado ou inativo    │
│    no sistema.                          │
└─────────────────────────────────────────┘
```

**Erro 4: Erro Interno**
```javascript
// Server Action retorna:
{ error: "Erro interno ao tentar realizar login." }

// Interface mostra:
┌──────────────────────────────────┐
│ ⚠️ Erro interno ao tentar        │
│    realizar login.               │
└──────────────────────────────────┘
```

---

### `LoginPage.module.css`
**Tipo:** CSS Module (escopo local)  
**Função:** Estilização da página de login

#### O Que Este Arquivo Faz

**1. Layout da Página**
```css
.pageWrapper {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f4f6f8;
}
```
- Ocupa tela inteira (`100vh`)
- Layout vertical (coluna)
- Fundo cinza claro
- Estrutura: Header (topo) + Main (centro)

**2. Header Fixo**
```css
.loginHeader {
  height: 60px;
  background-color: #1e293b;  /* Cinza escuro */
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2rem;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}
```
- Altura fixa 60px
- Fundo escuro profissional
- Texto branco
- Espaço entre logo e badge (`space-between`)
- Sombra sutil embaixo

**3. Logo/Brand**
```css
.brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: bold;
  font-size: 1.1rem;
}
```
- Logo (SVG) + Texto lado a lado
- Espaço de 12px entre eles
- Negrito
- Tamanho 1.1rem (≈ 17.6px)

**4. Badge "Acesso Restrito"**
```css
.badge {
  font-size: 0.85rem;
  color: #94a3b8;  /* Cinza médio */
}
```
- Menor que texto principal
- Cor neutra (não chama atenção)

**5. Área Principal (Main)**
```css
.mainContent {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}
```
- Ocupa espaço restante (`flex: 1`)
- Centraliza conteúdo (horizontal + vertical)
- Padding para não encostar nas bordas

**6. Card do Formulário**
```css
.card {
  background-color: #ffffff;
  padding: 2.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  width: 100%;
  max-width: 380px;
}
```
- Fundo branco
- Padding generoso (40px)
- Bordas arredondadas
- Sombra suave
- Largura máxima: 380px (não fica muito largo em telas grandes)

**7. Título "Identifique-se"**
```css
.title {
  margin-bottom: 1.5rem;
  text-align: center;
  color: #0f172a;  /* Quase preto */
  font-size: 1.25rem;
  font-weight: 600;
}
```
- Centralizado
- Espaço embaixo (24px)
- Cor escura
- Semi-negrito (600)

**8. Mensagem de Erro**
```css
.errorMessage {
  background-color: #fef2f2;  /* Rosa claro */
  color: #991b1b;  /* Vermelho escuro */
  border: 1px solid #fecaca;  /* Borda rosa */
  padding: 0.6rem;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 1rem;
  text-align: center;
}
```
- Fundo rosa suave (não agressivo)
- Texto vermelho escuro (legível)
- Borda rosa
- Centralizado
- Box arredondado

**9. Grupos de Input**
```css
.inputGroup {
  margin-bottom: 1rem;  /* 16px entre campos */
}

.inputGroupLast {
  margin-bottom: 1.5rem;  /* 24px antes do botão */
}
```
- `inputGroup`: Espaço normal entre campos
- `inputGroupLast`: Mais espaço antes do botão

**10. Labels**
```css
.label {
  display: block;
  font-size: 14px;
  margin-bottom: 6px;
  color: #334155;  /* Cinza escuro */
  font-weight: 500;
}
```
- Bloco (ocupa linha inteira)
- Pequeno mas legível
- Espaço de 6px até input
- Semi-negrito (500)

**11. Inputs**
```css
.input {
  width: 100%;
  padding: 10px 12px;
  border-radius: 4px;
  border: 1px solid #cbd5e0;  /* Cinza claro */
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s ease;
}

.input:focus {
  border-color: #2563eb;  /* Azul ao focar */
}
```
- Largura total
- Padding confortável
- Borda cinza (estado normal)
- Borda azul (estado focado)
- Transição suave
- Remove outline padrão

**12. Botão**
```css
.button {
  width: 100%;
  padding: 12px;
  background-color: #2563eb;  /* Azul */
  color: #ffffff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  font-size: 14px;
  transition: opacity 0.2s ease, background-color 0.2s ease;
}

.button:hover {
  background-color: #1d4ed8;  /* Azul mais escuro */
}

.buttonDisabled {
  opacity: 0.7;
  cursor: not-allowed;
}
```
- Largura total
- Fundo azul vibrante
- Texto branco
- Hover: escurece ligeiramente
- Disabled: opacidade 70% + cursor "not-allowed"

---

#### Hierarquia Visual

```
┌────────────────────────────────────────┐
│  Header (60px, fundo escuro)           │
│  [Logo] IntegraSaude    Acesso Restrito  │
└────────────────────────────────────────┘
│                                        │
│         ┌────────────────┐             │
│         │                │             │
│         │ Identifique-se │             │
│         │                │             │
│         │ [Erro]         │             │
│         │                │             │
│         │ CPF:           │             │
│         │ [__________]   │             │
│         │                │             │
│         │ Senha:         │             │
│         │ [__________]   │             │
│         │                │             │
│         │ [Entrar no     │             │
│         │  Sistema]      │             │
│         │                │             │
│         └────────────────┘             │
│                                        │
└────────────────────────────────────────┘
```

---

## 🔄 Estados da Página

### Estado 1: Inicial
```javascript
msg = ''
loading = false
```
**Tela:**
- Formulário vazio
- Botão: "Entrar no Sistema" (habilitado)
- Sem mensagens

### Estado 2: Carregando
```javascript
msg = ''
loading = true
```
**Tela:**
- Formulário preenchido
- Botão: "Acessando..." (desabilitado, opacidade 70%)
- Cursor: not-allowed
- Aguardando resposta do servidor

### Estado 3: Erro
```javascript
msg = 'Senha incorreta. Tente novamente.'
loading = false
```
**Tela:**
- Box de erro vermelho/rosa
- Botão: "Entrar no Sistema" (habilitado novamente)
- Campos mantêm valores digitados

### Estado 4: Sucesso
```javascript
// Não fica nesta página!
// Redireciona para destino do role
```

---

## 🔐 Segurança

### Proteções Implementadas

**1. Senha Nunca Visível**
```html
<input type="password" />
```
- Esconde caracteres com `•••••`

**2. Validação Server-Side**
```javascript
await loginAction(formData);  // Valida no servidor, não no cliente
```
- Cliente nunca vê lógica de validação
- Impossível burlar via JavaScript

**3. Cookie HTTP-Only**
```javascript
// Server Action cria:
cookies().set('session_token', jwt, {
  httpOnly: true  // JavaScript não pode acessar
});
```
- Proteção contra XSS

**4. JWT Assinado**
```javascript
// Server Action assina com secret:
const token = await new SignJWT({...}).sign(secret);
```
- Impossível falsificar

**5. Rate Limiting (Recomendado)**
```javascript
// TODO: Implementar no futuro
// Limitar tentativas de login por IP/CPF
```

### Informações NÃO Expostas

- ❌ Lista de usuários válidos
- ❌ Estrutura da senha
- ❌ JWT_SECRET
- ❌ Lógica de validação
- ❌ Queries SQL

---

## 📱 Responsividade

```css
/* Mobile: já funciona bem! */
max-width: 380px;  /* Card não fica enorme */
padding: 1.5rem;   /* Respira nas bordas */
```

**Telas pequenas (< 380px):**
- Card ocupa 100% da largura disponível
- Padding garante espaço nas laterais

**Telas grandes (> 380px):**
- Card fixo em 380px
- Centralizado

---

## 🧪 Testes Manuais

### Teste 1: Login Bem-Sucedido
```
1. Acesse /login
2. Digite CPF: 12912453674
3. Digite Senha: regula@saude_2026
4. Clique "Entrar no Sistema"
5. Aguarde "Acessando..."
6. Deve redirecionar para / (Dashboard)
```

### Teste 2: CPF Incorreto
```
1. Digite CPF: 11111111111 (não existe)
2. Digite Senha: qualquer
3. Clique "Entrar"
4. Deve mostrar: "Usuário não encontrado ou inativo no sistema."
```

### Teste 3: Senha Incorreta
```
1. Digite CPF: 12912453674 (existe)
2. Digite Senha: senhaerrada
3. Clique "Entrar"
4. Deve mostrar: "Senha incorreta. Tente novamente."
```

### Teste 4: Campos Vazios
```
1. Deixe campos vazios
2. Clique "Entrar"
3. HTML5 validation impede submit
4. Mostra tooltip "Preencha este campo"
```

### Teste 5: Múltiplos Cliques
```
1. Preencha formulário
2. Clique "Entrar" várias vezes rápido
3. Botão desabilita após primeiro clique
4. Previne múltiplos submits
```

---

## 🔗 Arquivos Relacionados

| Arquivo | Relação |
|---------|---------|
| `src/app/actions/auth.js` | Server Action chamado pelo form |
| `src/middleware.js` | Valida JWT após login |
| `src/app/dashboard/page.js` | Destino após login (GESTOR) |
| `src/app/regulacao/page.js` | Destino após login (REGULACAO) |

---

## 📚 Referências

- [Next.js Client Components](https://nextjs.org/docs/app/building-your-application/rendering/client-components)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)
- [React useState](https://react.dev/reference/react/useState)
- [Next.js useRouter](https://nextjs.org/docs/app/api-reference/functions/use-router)

---

**Resumo:** Esta pasta contém a página de login do sistema, com formulário de CPF + senha, validação server-side, e redirecionamento automático para o módulo apropriado de cada usuário baseado em seu role.
