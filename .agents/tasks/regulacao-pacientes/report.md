# Regulação: remover aba "Usuários" e adicionar aba "Pacientes"

## Parte 1 — Remoção da aba "Usuários" da Regulação
- `src/app/regulacao/UsuariosTab.js` — REMOVIDO.
- `src/app/regulacao/page.js` — removido o import de `UsuariosTab`, o bloco `activeTab === "USUARIOS"` e o uso de `podeGerenciarUsuarios`.
- `src/app/regulacao/layout.js` — removida a const `podeGerenciarUsuarios = await usuarioEhGestor(...)` e a prop `podeGerenciarUsuarios` passada ao `RegulacaoPermProvider`.
- `src/app/regulacao/PermissoesRegulacaoContext.js` — removido `podeGerenciarUsuarios` do contexto/provider.
- `src/components/Sidebar.js` — removido o item de menu "Usuários" (tab `USUARIOS`, `visivelSe: "GESTOR"`) do dropdown "Regulação".
- `src/components/GerenciarUsuarios/` — MANTIDO. Após remover o uso na Regulação, passa a ser consumido somente pelo Gerenciamento (`src/app/gerenciamento/usuarios/page.js`), que depende dele. Nada foi quebrado.
- Confirmado por grep: nenhuma referência restante a `UsuariosTab` / `USUARIOS` / `podeGerenciarUsuarios` no módulo Regulação (nem em `src/**/*.js`).
- O item "Gerenciar Usuários" do dropdown "Gerenciamento" (recurso próprio do Gerenciamento) permanece intacto.

## Parte 2 — Adição da aba "Pacientes" na Regulação
Padrão seguido: igual ao `ProcedimentosTab` (wrapper fino + bloco `activeTab` + item no Sidebar).

UI reutilizada (não duplicada): seguindo o precedente do projeto (a tela de
usuários foi extraída para `src/components/GerenciarUsuarios`), a tela de
pessoas foi extraída para um componente compartilhado em
`src/components/CadastroPessoas/CadastroPessoas.js` (+ `.module.css`), consumido
tanto pelo Gerenciamento quanto pela Regulação. Uma única fonte de UI.

- `src/components/CadastroPessoas/CadastroPessoas.js` — NOVO. Corpo integral da antiga `PessoasPage`, `export default function CadastroPessoas()`. Importa as MESMAS server actions de `@/app/gerenciamento/pessoas/actions` (nenhum CRUD paralelo criado).
- `src/components/CadastroPessoas/CadastroPessoas.module.css` — NOVO (cópia do antigo `Pessoas.module.css`).
- `src/app/gerenciamento/pessoas/page.js` — agora renderiza `<CadastroPessoas />` (wrapper fino). Layout e actions do Gerenciamento inalterados.
- `src/app/gerenciamento/pessoas/Pessoas.module.css` — REMOVIDO (conteúdo migrado para o componente compartilhado; sem outras referências).
- `src/app/regulacao/PacientesTab.js` — NOVO. Wrapper `'use client'` que renderiza `<CadastroPessoas />`.
- `src/app/regulacao/page.js` — import de `PacientesTab` e bloco `activeTab === "PACIENTES"` (logo após `PROCEDIMENTOS`), com gate pela flag `podeGerenciarPessoas` (senão `AcessoNegadoModulo`).
- `src/components/Sidebar.js` — item "Pacientes" (tab `PACIENTES`, `visivelSe: "PESSOAS_ACESSO"`) no dropdown "Regulação", logo após "Procedimentos".

### Actions/rotas reutilizadas
`listarPessoas`, `listarUbs`, `criarPessoa`, `atualizarPessoa`, `excluirPessoa`
de `src/app/gerenciamento/pessoas/actions.js` — as mesmas. Elas já chamam
`requireAcessoPessoas()` (enforcement server-side; não afrouxado).

### Regra de permissão replicada
Regra do cadastro de pessoas do Gerenciamento:
**GESTOR ∨ REGULACAO/ADMIN ∨ JUNTA/ADMIN** (ver `gerenciamento/pessoas/layout.js`
e `requireAcessoPessoas` em `src/lib/auth.js`). Replicada nas 3 camadas:
1. Menu (apresentação): novo case `PESSOAS_ACESSO` em `Sidebar.js` →
   `ehGestor || ehAdminMod("REGULACAO") || ehAdminMod("JUNTA")`.
2. Conteúdo: flag `podeGerenciarPessoas` calculada no servidor em
   `regulacao/layout.js` (mesma expressão) e injetada via `RegulacaoPermProvider`;
   gate em `page.js` com `AcessoNegadoModulo` quando falso (fail-closed).
3. Rotas/actions: inalteradas — já exigem `requireAcessoPessoas()`.

## Verificação executada
- `npm run lint` → **0 erros, 5 warnings preexistentes** (CadastroTutor, FichaCompletaAnimal, login, HistoricoPedidoModal, RelatorioAcessos — nenhum nos arquivos tocados). Exit 0.
- `npm run build` → **compilou com sucesso** (Next 16.3.0). `/regulacao` e `/gerenciamento/pessoas` presentes como rotas server-rendered. Exit 0.
- Verificação visual via navegador: NÃO realizada. O ambiente bloqueia processos de servidor de longa duração e não há credenciais para autenticar uma sessão. Validado server-side por build + inspeção de código das 3 camadas de permissão. Nenhum servidor/temporário deixado em execução (porta 3100 sem listener).

## Observações
- Não foram alterados `prisma/schema.prisma`, migrations, `.env*` nem dados do banco.
- Nenhuma mudança não relacionada foi desfeita (SeletorPaciente, Supabase, lint, docker etc.).
- Nenhum `git add/commit/push`/comando git destrutivo executado.
