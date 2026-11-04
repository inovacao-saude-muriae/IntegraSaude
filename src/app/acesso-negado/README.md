# 📁 `/src/app/acesso-negado` - Página de Acesso Negado

Página exibida quando um usuário tenta acessar uma rota para a qual não tem permissão.

**Rota:** `/acesso-negado`  
**Acesso:** Pública (mas controlada pelo middleware)

---

## 📄 Arquivos Nesta Pasta

### `page.js`
**Tipo:** Server Component (Next.js 16)  
**Função:** Renderiza a página de erro de permissão negada

#### O Que Este Arquivo Faz

**1. Metadata (SEO)**
```javascript
export const metadata = {
  title: 'Acesso Negado - IntegraSaude',
  description: 'Você não tem permissão para acessar esta página',
};
```
- Define título da aba do navegador
- Melhora SEO (mas página não deve ser indexada)

**2. Mapeamento de Roles**
```javascript
const CARGO_LABELS = {
  'GESTOR': 'Gestor Geral',
  'REGULACAO_ADMIN': 'Administrador da Regulação',
  'REGULACAO_COMUM': 'Usuário da Regulação',
  // ... outros 9 cargos
};
```
- Converte código técnico (`REGULACAO_ADMIN`) em texto amigável ("Administrador da Regulação")
- Facilita compreensão do usuário
- Centraliza nomenclatura dos cargos

**3. Componente Principal**
```javascript
export default function AcessoNegado({ searchParams })
```
- Recebe parâmetros da URL via `searchParams`
- Parâmetros esperados:
  - `rota` - Rota que o usuário tentou acessar
  - `role` - Cargo atual do usuário

**4. Extração de Parâmetros**
```javascript
const rota = searchParams?.rota || 'esta página';
const role = searchParams?.role || 'desconhecido';
const cargoLabel = CARGO_LABELS[role] || role;
```
- `rota`: Path que foi bloqueado (ex: `/regulacao/financeiro`)
- `role`: Cargo do usuário (ex: `REGULACAO_COMUM`)
- `cargoLabel`: Nome amigável do cargo
- Usa valores padrão se parâmetros estiverem ausentes

**5. Interface da Página**
- **Ícone:** 🚫 (emoji de proibido)
- **Título:** "Acesso Negado"
- **Mensagem:** Informa qual rota foi bloqueada
- **Info Box:** Mostra cargo atual do usuário
- **Explicação:** Texto orientando sobre permissões
- **Ações:** Dois botões para navegação

**6. Botões de Ação**
```javascript
<Link href="/dashboard">Voltar ao Dashboard</Link>
<Link href="/login">Fazer Login com Outro Usuário</Link>
```
- **Dashboard:** Volta para área segura (sempre permitida)
- **Login:** Permite trocar de usuário (se tiver outro com mais permissões)

#### Como o Usuário Chega Aqui

**Fluxo:**
```
1. Usuário tenta acessar /regulacao/financeiro
   ↓
2. middleware.js intercepta
   ↓
3. Verifica JWT e identifica role: REGULACAO_COMUM
   ↓
4. Consulta PERMISSOES_ROTAS
   ↓
5. REGULACAO_COMUM NÃO está na lista de /regulacao/financeiro
   ↓
6. Middleware redireciona para:
   /acesso-negado?rota=/regulacao/financeiro&role=REGULACAO_COMUM
   ↓
7. Esta página é renderizada
```

#### Exemplo de URLs

**URL Completa:**
```
/acesso-negado?rota=%2Fregulacao%2Ffinanceiro&role=REGULACAO_COMUM
```

**Decodificado:**
```
/acesso-negado?rota=/regulacao/financeiro&role=REGULACAO_COMUM
```

**Resultado na Tela:**
```
🚫
Acesso Negado

Você não tem permissão para acessar: /regulacao/financeiro

Seu cargo atual:
Usuário da Regulação

Cada usuário tem acesso apenas aos módulos específicos do seu cargo...
```

#### Casos de Uso

**1. REGULACAO_COMUM tenta acessar financeiro**
```
Bloqueado: /regulacao/financeiro
Cargo: Usuário da Regulação
Motivo: Apenas REGULACAO_ADMIN pode ver financeiro
```

**2. JUNTA_CAEE tenta acessar educação**
```
Bloqueado: /junta-reguladora/educacao
Cargo: Usuário do CAEE
Motivo: CAEE só acessa /junta-reguladora/caee
```

**3. CCZ_ADMIN tenta acessar regulação**
```
Bloqueado: /regulacao
Cargo: Administrador do CCZ
Motivo: CCZ não tem acesso ao módulo regulação
```

---

### `page.module.css`
**Tipo:** CSS Module (escopo local)  
**Função:** Estilização da página de acesso negado

#### O Que Este Arquivo Faz

**1. Container Principal**
```css
.container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```
- Ocupa tela inteira (`100vh`)
- Centraliza conteúdo (flex)
- Gradiente roxo/azul de fundo
- Cria atmosfera visual de "bloqueio"

**2. Card de Conteúdo**
```css
.content {
  background: white;
  border-radius: 16px;
  padding: 3rem 2rem;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
```
- Card branco centraliado
- Bordas arredondadas
- Sombra forte para destacar
- Largura máxima: 500px

**3. Animação do Ícone**
```css
.icon {
  font-size: 5rem;
  animation: shake 0.5s ease-in-out;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10px); }
  75% { transform: translateX(10px); }
}
```
- Ícone grande (5rem = 80px)
- Animação de "tremor" ao carregar
- Dura 0.5 segundos
- Chama atenção do usuário

**4. Título**
```css
.title {
  font-size: 2rem;
  font-weight: 700;
  color: #1a202c;
}
```
- Tamanho grande (32px)
- Negrito (weight: 700)
- Cor escura (#1a202c)

**5. Info Box (Cargo Atual)**
```css
.info {
  background: #f7fafc;
  border-left: 4px solid #667eea;
  padding: 1rem 1.5rem;
  border-radius: 4px;
}
```
- Fundo cinza claro
- Borda esquerda roxa (destaque)
- Box arredondado
- Visual de "aviso informativo"

**6. Botão Principal**
```css
.button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  transition: transform 0.2s, box-shadow 0.2s;
}

.button:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.4);
}
```
- Gradiente roxo (mesma cor do fundo)
- Texto branco
- Hover: levanta 2px + sombra
- Efeito de "elevação"

**7. Botão Secundário**
```css
.buttonSecondary {
  background: white;
  color: #667eea;
  border: 2px solid #667eea;
}

.buttonSecondary:hover {
  background: #667eea;
  color: white;
}
```
- Começa transparente (outline)
- Hover: inverte cores (preenche)
- Transição suave

**8. Responsividade**
```css
@media (max-width: 640px) {
  .content {
    padding: 2rem 1.5rem;
  }
  .title {
    font-size: 1.5rem;
  }
  .icon {
    font-size: 4rem;
  }
}
```
- Em telas menores que 640px (mobile):
  - Reduz padding
  - Diminui título
  - Diminui ícone
- Garante legibilidade em celulares

#### Hierarquia Visual

```
┌─────────────────────────────────┐
│  Fundo Gradiente (Tela Inteira) │
│  ┌───────────────────────────┐  │
│  │   Card Branco (Centro)    │  │
│  │                           │  │
│  │   🚫 (5rem, animado)      │  │
│  │                           │  │
│  │   Acesso Negado (2rem)    │  │
│  │                           │  │
│  │   Mensagem (1.125rem)     │  │
│  │   ┌───────────────────┐   │  │
│  │   │ Info Box (Cargo)  │   │  │
│  │   └───────────────────┘   │  │
│  │   Explicação (0.875rem)   │  │
│  │                           │  │
│  │   [Botão Dashboard]       │  │
│  │   [Botão Login]           │  │
│  │                           │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

---

## 🔄 Fluxo Completo

### Cenário: REGULACAO_COMUM tenta acessar Financeiro

**1. Usuário clica em "Financeiro"**
```
URL: /regulacao/financeiro
```

**2. Middleware intercepta**
```javascript
// src/middleware.js
const userRole = payload.role; // "REGULACAO_COMUM"
const pathname = "/regulacao/financeiro";

// Verifica permissões
const permitidos = PERMISSOES_ROTAS["/regulacao/financeiro"];
// permitidos = ["GESTOR", "REGULACAO_ADMIN"]

if (!permitidos.includes(userRole)) {
  // BLOQUEADO!
  return NextResponse.redirect(
    "/acesso-negado?rota=/regulacao/financeiro&role=REGULACAO_COMUM"
  );
}
```

**3. Página renderiza**
```javascript
// page.js recebe:
searchParams = {
  rota: "/regulacao/financeiro",
  role: "REGULACAO_COMUM"
}

// Converte role:
cargoLabel = CARGO_LABELS["REGULACAO_COMUM"]
// = "Usuário da Regulação"

// Renderiza:
"Você não tem permissão para acessar: /regulacao/financeiro"
"Seu cargo atual: Usuário da Regulação"
```

**4. Usuário vê a tela**
```
🚫
Acesso Negado

Você não tem permissão para acessar: /regulacao/financeiro

╔════════════════════════════╗
║ Seu cargo atual:           ║
║ Usuário da Regulação       ║
╚════════════════════════════╝

Cada usuário tem acesso apenas aos módulos...

[Voltar ao Dashboard] [Fazer Login com Outro Usuário]
```

**5. Opções do Usuário**
- **Voltar ao Dashboard** → `/dashboard` (permitido)
- **Trocar de Usuário** → `/login` (fazer logout e login com REGULACAO_ADMIN)

---

## 🎨 Design e UX

### Cores Utilizadas

| Cor | Uso | Código |
|-----|-----|--------|
| Roxo/Azul | Fundo, botões | `#667eea`, `#764ba2` |
| Branco | Card, texto botão | `#ffffff` |
| Preto suave | Título | `#1a202c` |
| Cinza médio | Texto | `#4a5568` |
| Cinza claro | Info box | `#f7fafc` |

### Hierarquia de Informação

1. **🚫 Ícone** - Chama atenção imediatamente
2. **"Acesso Negado"** - Título claro e direto
3. **Rota bloqueada** - Mostra O QUE foi negado
4. **Cargo atual** - Explica POR QUE foi negado
5. **Orientação** - Ensina o que fazer
6. **Ações** - Oferece saídas

### Princípios de UX

- ✅ **Clareza:** Mensagem direta sem jargões técnicos
- ✅ **Contexto:** Mostra rota E cargo
- ✅ **Educação:** Explica o sistema de permissões
- ✅ **Saídas:** Oferece 2 caminhos claros
- ✅ **Feedback Visual:** Animação + cores chamam atenção
- ✅ **Responsivo:** Funciona em mobile e desktop

---

## 🔐 Segurança

### Por Que Esta Página Existe?

**Sem ela:**
```
Usuário tenta acessar → Rota carrega → Vê dados proibidos
```

**Com ela:**
```
Usuário tenta acessar → Middleware bloqueia → Mostra erro amigável
```

### Informações Expostas (Seguras)

- ✅ Rota tentada (usuário já sabia)
- ✅ Cargo próprio (usuário já sabe seu cargo)
- ✅ Sistema de permissões existe (informação pública)

### Informações NÃO Expostas

- ❌ Quais outros cargos têm acesso
- ❌ Estrutura de permissões completa
- ❌ Dados da rota bloqueada
- ❌ Lista de todos os cargos

---

## 📱 Responsividade

### Desktop (> 640px)
```
┌────────────────────────────────────┐
│                                    │
│        ┌──────────────┐            │
│        │              │            │
│        │   🚫 5rem    │            │
│        │   Conteúdo   │            │
│        │   Completo   │            │
│        │              │            │
│        └──────────────┘            │
│                                    │
└────────────────────────────────────┘
```

### Mobile (≤ 640px)
```
┌──────────────┐
│              │
│  🚫 4rem     │
│  Título      │
│  1.5rem      │
│              │
│  Mensagem    │
│  Compacta    │
│              │
│  [Botão]     │
│  [Botão]     │
│              │
└──────────────┘
```

---

## 🧪 Testes Manuais

### Testar Diferentes Roles

**1. Login como REGULACAO_COMUM**
```bash
# Tente acessar:
/regulacao/financeiro
```
**Esperado:** Bloqueado, mostra "Usuário da Regulação"

**2. Login como JUNTA_CAEE**
```bash
# Tente acessar:
/junta-reguladora/educacao
```
**Esperado:** Bloqueado, mostra "Usuário do CAEE"

**3. Login como CCZ_ADMIN**
```bash
# Tente acessar:
/regulacao
```
**Esperado:** Bloqueado, mostra "Administrador do CCZ"

**4. Login como GESTOR**
```bash
# Tente acessar qualquer rota
```
**Esperado:** NUNCA chega nesta página (tem acesso total)

---

## 🔗 Arquivos Relacionados

| Arquivo | Relação |
|---------|---------|
| `src/middleware.js` | Redireciona para esta página |
| `src/app/login/page.js` | Botão "Fazer Login" vai para lá |
| `src/app/dashboard/page.js` | Botão "Dashboard" vai para lá |
| `src/app/globals.css` | Estilos globais aplicados |

---

## 📚 Referências

- [Next.js Search Params](https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional)
- [Next.js Metadata](https://nextjs.org/docs/app/building-your-application/optimizing/metadata)
- [CSS Modules](https://nextjs.org/docs/app/building-your-application/styling/css-modules)
- [UX Error Messages](https://uxdesign.cc/how-to-write-good-error-messages-858e4551cd4)

---

**Resumo:** Esta pasta contém a página que informa o usuário quando ele tenta acessar uma área para qual não tem permissão, mostrando seu cargo atual e oferecendo caminhos alternativos.
