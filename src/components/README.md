# 📁 `/src/components` - Componentes Reutilizáveis

Componentes React compartilhados em todo o projeto.

---

## 📄 Arquivos Nesta Pasta

### `Header.js`
**Função:** Cabeçalho principal do sistema.

**Exibe:**
- 🏥 Logo/Título do IntegraSaude
- 👤 Nome do usuário logado
- 🎯 Cargo/Role do usuário
- 🚪 Botão de logout
- 📱 Menu de navegação (responsivo)

**Props:**
```javascript
<Header 
  userName="João Silva"
  userRole="REGULACAO_ADMIN"
  cargo="Coordenador de Regulação"
/>
```

**Onde é usado:**
- `src/app/layout.js` (layout global)
- Aparece em todas as páginas autenticadas

**Recursos:**
- Dropdown com informações do usuário
- Link para perfil/configurações
- Ação de logout (limpa cookie + redireciona)

---

### `Sidebar.js`
**Função:** Menu lateral de navegação.

**Exibe:**
- 📊 Dashboard
- 🏥 Módulos do sistema (Regulação, Farmácia, etc)
- ⚙️ Configurações (se admin)
- 👥 Gestão de usuários (se gestor)

**Comportamento:**
- Mostra apenas módulos permitidos pelo role do usuário
- Destaca rota ativa
- Colapsa em telas pequenas (mobile)

**Exemplo de Permissões:**
```javascript
// REGULACAO_COMUM vê:
- Dashboard
- Regulação (sem Financeiro)

// GESTOR vê:
- Dashboard
- Todos os módulos
- Admin / Usuários
```

**Onde é usado:**
- `src/app/layout.js` (layout global)
- Visível em todas as páginas internas

---

### `Footer.js`
**Função:** Rodapé do sistema.

**Exibe:**
- © Copyright Prefeitura Municipal
- Versão do sistema
- Links úteis (suporte, documentação)
- Informações de contato

**Onde é usado:**
- `src/app/layout.js` (layout global)

---

### `LoadingSpinner.js`
**Função:** Indicador de carregamento.

**Tipos:**
- Spinner circular
- Barra de progresso
- Skeleton loader

**Props:**
```javascript
<LoadingSpinner 
  size="large"       // small, medium, large
  color="primary"    // primary, secondary
  text="Carregando..." // Texto opcional
/>
```

**Onde é usado:**
- Páginas com loading states
- Botões durante submit
- Lazy loading de componentes

---

### `Card.js`
**Função:** Container visual para agrupar conteúdo.

**Props:**
```javascript
<Card
  title="Título do Card"
  subtitle="Subtítulo opcional"
  variant="default"  // default, primary, danger
  hoverable={true}   // Efeito hover
>
  <p>Conteúdo do card</p>
</Card>
```

**Onde é usado:**
- Dashboard (estatísticas)
- Listagens
- Formulários agrupados

---

### `Button.js`
**Função:** Botão estilizado e padronizado.

**Variantes:**
```javascript
<Button variant="primary">Salvar</Button>
<Button variant="secondary">Cancelar</Button>
<Button variant="danger">Excluir</Button>
<Button variant="ghost">Link</Button>
```

**Props:**
```javascript
<Button
  variant="primary"
  size="medium"      // small, medium, large
  loading={false}    // Mostra spinner
  disabled={false}
  fullWidth={false}
  onClick={handleClick}
>
  Texto do Botão
</Button>
```

**Estados:**
- Normal
- Hover
- Loading (com spinner)
- Disabled

---

### `Modal.js`
**Função:** Janela modal para ações importantes.

**Props:**
```javascript
<Modal
  isOpen={isOpen}
  onClose={handleClose}
  title="Confirmar Ação"
  size="medium"      // small, medium, large, full
>
  <p>Tem certeza que deseja continuar?</p>
  <Button onClick={handleConfirm}>Sim</Button>
  <Button onClick={handleClose}>Não</Button>
</Modal>
```

**Recursos:**
- Overlay escuro
- Fecha com ESC
- Fecha clicando fora
- Bloqueia scroll da página
- Animações de entrada/saída

**Onde é usado:**
- Confirmações de exclusão
- Formulários de criação rápida
- Visualização de detalhes

---

### `Table.js`
**Função:** Tabela responsiva e estilizada.

**Props:**
```javascript
<Table
  columns={[
    { key: 'nome', label: 'Nome' },
    { key: 'cpf', label: 'CPF' },
    { key: 'cargo', label: 'Cargo' },
  ]}
  data={usuarios}
  onRowClick={handleRowClick}
  loading={false}
  emptyMessage="Nenhum registro encontrado"
/>
```

**Recursos:**
- Ordenação por coluna
- Paginação
- Busca integrada
- Seleção de linhas
- Ações por linha (editar, excluir)
- Responsivo (scroll horizontal em mobile)

---

### `Form.js`
**Função:** Wrapper para formulários padronizados.

**Props:**
```javascript
<Form onSubmit={handleSubmit}>
  <FormField
    label="Nome"
    name="nome"
    type="text"
    required
    error={errors.nome}
  />
  <FormField
    label="CPF"
    name="cpf"
    type="text"
    mask="999.999.999-99"
  />
  <Button type="submit">Salvar</Button>
</Form>
```

**Validações:**
- Client-side (antes de enviar)
- Server-side (Server Actions)
- Mensagens de erro inline
- Estados: pristine, dirty, submitting

---

## 🎨 Convenções de Estilo

### CSS Modules
```javascript
import styles from './MeuComponente.module.css';

export default function MeuComponente() {
  return <div className={styles.container}>...</div>;
}
```

### Classes Utilitárias
```javascript
<div className="flex justify-between items-center gap-4">
  {/* Layout flexbox */}
</div>
```

---

## 📁 Organização Recomendada

```
components/
├── layout/           # Header, Footer, Sidebar
│   ├── Header.js
│   ├── Footer.js
│   └── Sidebar.js
├── ui/              # Botões, Cards, Inputs
│   ├── Button.js
│   ├── Card.js
│   └── Input.js
├── feedback/        # Loading, Alerts, Toasts
│   ├── LoadingSpinner.js
│   ├── Alert.js
│   └── Toast.js
└── data/            # Tables, Lists
    ├── Table.js
    └── List.js
```

---

## 🔧 Como Criar Novo Componente

### 1. Crie o arquivo
```bash
touch src/components/MeuComponente.js
```

### 2. Estrutura básica
```javascript
'use client'; // Se usar hooks/eventos

import styles from './MeuComponente.module.css';

export default function MeuComponente({ prop1, prop2 }) {
  return (
    <div className={styles.container}>
      <h2>{prop1}</h2>
      <p>{prop2}</p>
    </div>
  );
}
```

### 3. Crie o CSS Module (opcional)
```css
/* MeuComponente.module.css */
.container {
  padding: 1rem;
  background: #fff;
  border-radius: 8px;
}
```

### 4. Use no projeto
```javascript
import MeuComponente from '@/components/MeuComponente';

<MeuComponente prop1="Valor" prop2="Outro" />
```

---

## ✅ Boas Práticas

### DRY (Don't Repeat Yourself)
- ✅ Se um elemento aparece 3+ vezes → crie componente
- ✅ Props para customização
- ✅ Composition over inheritance

### Single Responsibility
- ✅ Cada componente faz UMA coisa bem feita
- ✅ Separe lógica de apresentação
- ✅ Use hooks customizados para lógica complexa

### Acessibilidade
- ✅ Use tags semânticas (`<button>`, `<nav>`, etc)
- ✅ Labels em inputs
- ✅ Alt text em imagens
- ✅ ARIA attributes quando necessário

---

## 📚 Leia Também

- [Estrutura de app/](../app/README.md)
- [Hooks customizados](../app/regulacao/hooks/README.md)
- [Guia de CSS Modules](https://nextjs.org/docs/app/building-your-application/styling/css-modules)
