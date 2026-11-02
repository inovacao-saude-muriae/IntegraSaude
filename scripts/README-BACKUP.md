# 📦 Scripts de Backup e Restauração - IntegraSaúde

## 📋 Pré-requisitos

Você precisa ter o **PostgreSQL client tools** instalado no Windows:

### Opção 1: Instalar PostgreSQL completo
- Download: https://www.postgresql.org/download/windows/
- Durante a instalação, marque "Command Line Tools"

### Opção 2: Instalar apenas as ferramentas
```powershell
# Via Chocolatey
choco install postgresql-client

# Via Scoop
scoop install postgresql
```

### Verificar instalação
```powershell
pg_dump --version
psql --version
```

---

## 🔄 Como fazer BACKUP

### Método 1: Script PowerShell (Recomendado)

```powershell
# Executar o script de backup
.\scripts\backup-database.ps1
```

O script irá:
- ✅ Criar pasta `backups/` automaticamente
- ✅ Gerar arquivo com data/hora: `backup_orion_20240903_143025.sql`
- ✅ Comprimir o backup automaticamente (.zip)
- ✅ Mostrar lista dos 10 backups mais recentes

### Método 2: Comando direto (Manual)

```powershell
# Definir senha
$env:PGPASSWORD = "minhasenhalocal"

# Criar backup
pg_dump -h 100.82.145.85 -p 5433 -U admin -d orion -F p -f backup.sql --no-owner --no-acl

# Limpar senha
Remove-Item Env:\PGPASSWORD
```

---

## 🔙 Como RESTAURAR um backup

### ⚠️ ATENÇÃO
**A restauração irá SOBRESCREVER todos os dados atuais do banco!**

### Método 1: Script PowerShell (Recomendado)

```powershell
# Restaurar um backup específico
.\scripts\restore-database.ps1 -BackupFile "backups\backup_orion_20240903_143025.sql"

# Ou se for arquivo comprimido
.\scripts\restore-database.ps1 -BackupFile "backups\backup_orion_20240903_143025.sql.zip"
```

O script irá:
- ✅ Pedir confirmação antes de restaurar
- ✅ Descomprimir automaticamente se for .zip
- ✅ Restaurar todos os dados

### Método 2: Comando direto (Manual)

```powershell
# Definir senha
$env:PGPASSWORD = "minhasenhalocal"

# Restaurar backup
psql -h 100.82.145.85 -p 5433 -U admin -d orion -f backup.sql

# Limpar senha
Remove-Item Env:\PGPASSWORD
```

---

## 📅 Backup Automatizado (Agendamento)

### Criar tarefa agendada no Windows

```powershell
# Abrir o Agendador de Tarefas
taskschd.msc
```

**Configurar:**
1. Criar Tarefa Básica
2. Nome: "Backup IntegraSaúde Diário"
3. Gatilho: Diariamente às 02:00
4. Ação: Iniciar um programa
   - Programa: `powershell.exe`
   - Argumentos: `-ExecutionPolicy Bypass -File "C:\Users\Jefinny\Documents\RegulaHub\scripts\backup-database.ps1"`
5. Marcar: "Executar com privilégios mais altos"

---

## 🗂️ Estrutura de Arquivos

```
RegulaHub/
├── backups/                          # Pasta de backups (criada automaticamente)
│   ├── backup_orion_20240903_143025.sql
│   ├── backup_orion_20240903_143025.sql.zip
│   └── backup_orion_20240904_020000.sql
└── scripts/
    ├── backup-database.ps1          # Script de backup
    ├── restore-database.ps1         # Script de restauração
    └── README-BACKUP.md             # Este arquivo
```

---

## 📊 Boas Práticas

### ✅ Recomendações

1. **Backup diário**: Configure backup automático diário
2. **Retenção**: Manter pelo menos 7 dias de backups
3. **Backup antes de mudanças**: Sempre faça backup antes de:
   - Atualizar o sistema
   - Fazer migrations do Prisma
   - Modificar dados em massa
4. **Teste de restauração**: Teste a restauração periodicamente
5. **Armazenamento externo**: Copie backups para outro servidor/nuvem

### 📦 Limpeza de Backups Antigos

```powershell
# Remover backups com mais de 30 dias
Get-ChildItem -Path "backups" -Filter "backup_*.sql*" | 
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) } | 
    Remove-Item -Force
```

---

## 🆘 Solução de Problemas

### Erro: "pg_dump não é reconhecido"

**Solução:** Adicione o PostgreSQL ao PATH:

```powershell
# Adicionar ao PATH (temporário)
$env:Path += ";C:\Program Files\PostgreSQL\16\bin"

# Ou adicionar permanentemente nas variáveis de ambiente do Windows
```

### Erro: "senha incorreta"

**Solução:** Verifique a senha no arquivo `.env.local`

### Backup muito grande

**Solução:** Use compressão:

```powershell
# Backup comprimido diretamente
pg_dump -h 100.82.145.85 -p 5433 -U admin -d orion -F c -f backup.dump
```

---

## 📞 Suporte

Para mais informações sobre pg_dump:
```powershell
pg_dump --help
```

Documentação oficial: https://www.postgresql.org/docs/current/app-pgdump.html
