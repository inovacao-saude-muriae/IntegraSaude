# 📁 `/prisma` - Schema e Migrations do Banco de Dados

Configuração do Prisma ORM e estrutura do banco PostgreSQL.

---

## 📄 Arquivos Nesta Pasta

### `schema.prisma`
**Função:** Define a estrutura COMPLETA do banco de dados.

**Contém:**
- **Generator:** Configuração do Prisma Client
- **Datasource:** Conexão com PostgreSQL
- **Models:** Tabelas e relações
- **Enums:** Tipos enumerados (ex: Role)

**Estrutura:**
```prisma
// Generator: como gerar o client
generator client {
  provider = "prisma-client-js"
}

// Datasource: onde está o banco
datasource db {
  provider = "postgresql"
}

// Enum: roles do sistema
enum Role {
  GESTOR
  REGULACAO_ADMIN
  // ... outros
}

// Model: tabela users
model User {
  cpf       String @id
  nome      String
  role      Role
  sessions  Session[]
  
  @@map("users")
}
```

**Seções Principais:**

#### 1. Autenticação e Sessões
```prisma
User      → Usuários do sistema
Session   → Sessões ativas (JWT)
```

#### 2. Pessoas e Endereços
```prisma
Pessoa    → Pessoas físicas (CPF único)
Endereco  → Endereços das pessoas
```

#### 3. Módulo Regulação
```prisma
TipoExame          → Tipos de exames
Procedimento       → Procedimentos médicos
Medico             → Médicos cadastrados
Ubs                → Unidades Básicas de Saúde
PedidoExame        → Pedidos de exames
CotaFinanceira     → Cotas financeiras mensais
```

#### 4. Módulo Farmácia Judicial
```prisma
PacienteFarmaciaJudicial  → Pacientes com processos
Medicamento               → Medicamentos disponíveis
LoteMedicamento           → Lotes de medicamentos
TratamentoPaciente        → Tratamentos prescritos
DispensacaoMedicamento    → Entregas realizadas
```

#### 5. Módulo Junta Reguladora
```prisma
PacienteJunta         → Pacientes da junta
JuntaServico          → Serviços (CAEE, Educação, etc)
PacienteJuntaServico  → Vinculo paciente-serviço
JuntaAtendimento      → Atendimentos realizados
```

#### 6. Módulo CCZ (Zoonoses)
```prisma
Tutor                   → Tutores de animais
Animal                  → Animais cadastrados
CadastroProcedimento    → Procedimentos veterinários
DenunciaCaoAgressivo    → Denúncias de cães agressivos
Esporotricose           → Casos de esporotricose
```

**Tipos de Dados:**
```prisma
String    → Texto
Int       → Número inteiro
Decimal   → Decimal (ex: valores monetários)
Boolean   → true/false
DateTime  → Data e hora
```

**Modificadores:**
```prisma
@id              → Chave primária
@unique          → Valor único
@default(...)    → Valor padrão
@map("...")      → Nome da coluna no banco
@@map("...")     → Nome da tabela no banco
@relation(...)   → Define relação entre tabelas
@db.VarChar(50)  → Tipo específico do PostgreSQL
```

---

### `seed.js`
**Função:** Popula o banco com dados iniciais (seeding).

**O que faz:**
1. Conecta ao banco via Prisma
2. Cria usuário **GESTOR** com:
   - CPF do `.env` (GESTOR_CPF)
   - Nome do `.env` (GESTOR_NOME)
   - Senha hasheada do `.env` (GESTOR_SENHA)
   - Role: GESTOR
3. Exibe confirmação no terminal

**Quando executar:**
```bash
# Após primeiro db push
npm run db:seed

# Ou após resetar banco
npm run db:reset
```

**Logs esperados:**
```
🌱 Iniciando seed do banco de dados...
✅ Usuário GESTOR configurado com sucesso!
👤 Nome: Jefinny de Paula Dias Souza
🆔 CPF/Login: 12912453674
🔑 Senha: regula@saude_2026
🎯 Permissão: GESTOR (Acesso Total)
🎉 Seed concluído com sucesso!
```

**Segurança:**
- ✅ Usa variáveis de ambiente (não hardcoded)
- ✅ Senha é hasheada com bcrypt (custo 10)
- ✅ Verifica se usuário já existe antes de criar

---

## 🗂️ Migrations (se houver)

**Pasta:** `prisma/migrations/`

**Função:** Histórico de mudanças no schema.

**Quando é criada:**
```bash
npm run db:migrate
```

**Estrutura:**
```
migrations/
├── 20260903_init/
│   └── migration.sql
└── 20260904_add_role_gestor/
    └── migration.sql
```

**Status atual:** 
- ⚠️ Projeto usa `db push` (desenvolvimento)
- 📝 Migrations não são necessárias ainda
- ✅ Para produção, usar migrations é recomendado

---

## 🔧 Comandos Prisma

### Desenvolvimento

```bash
# Sincroniza schema com banco (desenvolvimento)
npm run db:push

# Gera Prisma Client (tipos TypeScript)
npm run db:generate

# Popula banco com dados iniciais
npm run db:seed

# Abre interface gráfica do banco
npm run db:studio
```

### Produção

```bash
# Cria migration
npm run db:migrate

# Aplica migrations em produção
npx prisma migrate deploy

# Reseta banco (CUIDADO!)
npm run db:reset
```

---

## 📊 Relacionamentos no Banco

### 1:1 (Um para Um)
```prisma
model User {
  cpf   String @id
  tutor Tutor?  // Um usuário PODE ter um tutor
}

model Tutor {
  pessoaCpf String @id
  pessoa    Pessoa @relation(fields: [pessoaCpf], references: [cpf])
}
```

### 1:N (Um para Muitos)
```prisma
model Pessoa {
  cpf       String     @id
  enderecos Endereco[] // Uma pessoa PODE ter vários endereços
}

model Endereco {
  id        Int    @id @default(autoincrement())
  pessoaCpf String
  pessoa    Pessoa @relation(fields: [pessoaCpf], references: [cpf])
}
```

### N:N (Muitos para Muitos)
```prisma
model PacienteJunta {
  id       Int                    @id
  servicos PacienteJuntaServico[] // Tabela intermediária
}

model JuntaServico {
  id        Int                    @id
  pacientes PacienteJuntaServico[]
}

model PacienteJuntaServico {
  pacienteJuntaId Int
  servicoId       Int
  
  paciente PacienteJunta @relation(...)
  servico  JuntaServico  @relation(...)
  
  @@id([pacienteJuntaId, servicoId]) // Chave composta
}
```

---

## 🔍 Explorando o Banco

### Prisma Studio (Interface Gráfica)
```bash
npm run db:studio
```

**Funcionalidades:**
- ✅ Visualizar todos os dados
- ✅ Editar registros
- ✅ Criar novos registros
- ✅ Excluir registros
- ✅ Filtrar e buscar

**Acesso:** http://localhost:5555

### Query Manual (SQL)
```bash
# Conectar ao PostgreSQL
psql "postgresql://postgres.zamceeutjqodbxxlxeqa:SENHA@..."

# Listar tabelas
\dt

# Ver estrutura de tabela
\d users

# Query SQL
SELECT * FROM users WHERE role = 'GESTOR';
```

---

## 🔐 Boas Práticas

### ✅ O que FAZER
- Sempre rodar `db:generate` após mudar schema
- Usar `db:push` em desenvolvimento
- Usar `db:migrate` em produção
- Backup antes de `db:reset`
- Testar mudanças no schema em dev primeiro

### ❌ O que NÃO fazer
- Nunca editar tabelas manualmente em produção
- Nunca commitar `DATABASE_URL` real
- Nunca rodar `db:reset` em produção
- Não ignorar warnings do Prisma

---

## 🚀 Workflow de Mudanças no Schema

### Desenvolvimento

```bash
# 1. Editar schema.prisma
code prisma/schema.prisma

# 2. Sincronizar com banco
npm run db:push

# 3. Gerar tipos atualizados
npm run db:generate

# 4. Testar no código
npm run dev
```

### Produção

```bash
# 1. Criar migration
npm run db:migrate

# 2. Commitar migration
git add prisma/migrations
git commit -m "migration: adiciona campo email"

# 3. Deploy (CI/CD executa)
npx prisma migrate deploy
```

---

## 📚 Referências

- [Prisma Docs](https://www.prisma.io/docs)
- [Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)
- [Migrations Guide](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Prisma Studio](https://www.prisma.io/docs/concepts/components/prisma-studio)

---

## 🔗 Arquivos Relacionados

- `prisma.config.js` (raiz) → Configuração do Prisma CLI
- `src/lib/prisma.js` → Cliente Prisma (singleton)
- `.env` → Variáveis de conexão com banco
