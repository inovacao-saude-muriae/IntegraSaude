# 📁 `/src` - Código-Fonte da Aplicação

Pasta principal contendo todo o código-fonte do IntegraSaude.

---

## 📂 Estrutura

```
src/
├── app/            # Rotas e páginas (Next.js App Router)
├── components/     # Componentes React reutilizáveis
├── lib/            # Bibliotecas e utilitários
└── middleware.js   # Middleware de autenticação e autorização
```

---

## 📄 Arquivos Nesta Pasta

### `middleware.js`
**Função:** Middleware do Next.js que intercepta TODAS as requisições.

**Responsabilidades:**
- ✅ Valida token JWT em rotas protegidas
- ✅ Verifica permissões por role (12 cargos)
- ✅ Bloqueia acesso não autorizado
- ✅ Redireciona para login se não autenticado
- ✅ Redireciona para `/acesso-negado` se sem permissão

**Exemplo de Funcionamento:**
```javascript
// Usuário REGULACAO_COMUM tenta acessar /regulacao/financeiro
// Middleware verifica: role NÃO está na lista permitida
// Ação: Redireciona para /acesso-negado
```

**Rotas Públicas (sem autenticação):**
- `/login`
- `/_next/*` (arquivos internos do Next.js)
- `/api/*` (APIs têm validação própria)
- `/acesso-negado`

**Rotas Protegidas (necessitam autenticação + permissão):**
- Todas as outras rotas

---

## 🔗 Subpastas

### [`app/`](./app/README.md)
Rotas, páginas e APIs do sistema (Next.js App Router 16).

### [`components/`](./components/README.md)
Componentes React reutilizáveis (botões, cards, modais, etc).

### [`lib/`](./lib/README.md)
Bibliotecas, utilitários e configurações (Prisma, validações, helpers).

---

## 🔐 Fluxo de Autenticação

```
1. Usuário acessa /dashboard
   ↓
2. middleware.js intercepta
   ↓
3. Verifica cookie "session_token"
   ↓
4. Decodifica e valida JWT
   ↓
5. Verifica se role tem permissão para /dashboard
   ↓
6. Se OK: permite acesso
   Se FALHA: redireciona para /login ou /acesso-negado
```

---

## 📝 Convenções de Código

### Imports
```javascript
// Alias @ aponta para /src
import { prisma } from '@/lib/prisma';
import Header from '@/components/Header';
```

### Estrutura de Componentes
```javascript
'use client'; // Se usar hooks ou eventos

import { useState } from 'react';

export default function MeuComponente() {
  return <div>...</div>;
}
```

### Server Actions
```javascript
'use server';

import { prisma } from '@/lib/prisma';

export async function minhaAction(formData) {
  // Lógica server-side
}
```

---

## 🚀 Tecnologias Usadas

- **Next.js 16.3.0** - Framework (App Router)
- **React 19.2.8** - Biblioteca UI
- **Turbopack** - Bundler ultra-rápido
- **CSS Modules** - Estilização scoped
- **Server Actions** - Mutations server-side
- **jose** - JWT para autenticação

---

## 📚 Leia Também

- [Estrutura de app/](./app/README.md)
- [Componentes](./components/README.md)
- [Bibliotecas](./lib/README.md)
