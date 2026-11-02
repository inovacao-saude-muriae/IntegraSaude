# Script de Backup do Banco de Dados PostgreSQL - IntegraSaúde
# Uso: .\scripts\backup-database.ps1

# Configurações do banco
$DB_HOST = "100.82.145.85"
$DB_PORT = "5433"
$DB_NAME = "orion"
$DB_USER = "admin"
$DB_PASSWORD = "minhasenhalocal"

# Configurações de backup
$BACKUP_DIR = "backups"
$DATE = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$BACKUP_DIR/backup_$DB_NAME`_$DATE.sql"
$BACKUP_COMPRESSED = "$BACKUP_DIR/backup_$DB_NAME`_$DATE.sql.gz"

# Criar diretório de backup se não existir
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
    Write-Host "✓ Diretório de backup criado: $BACKUP_DIR" -ForegroundColor Green
}

Write-Host "`n=== Backup do Banco de Dados IntegraSaúde ===" -ForegroundColor Cyan
Write-Host "Banco: $DB_NAME" -ForegroundColor Yellow
Write-Host "Host: $DB_HOST`:$DB_PORT" -ForegroundColor Yellow
Write-Host "Arquivo: $BACKUP_FILE" -ForegroundColor Yellow
Write-Host ""

# Definir senha como variável de ambiente
$env:PGPASSWORD = $DB_PASSWORD

try {
    # Executar pg_dump
    Write-Host "Iniciando backup..." -ForegroundColor Cyan
    
    $pgDumpArgs = @(
        "-h", $DB_HOST,
        "-p", $DB_PORT,
        "-U", $DB_USER,
        "-d", $DB_NAME,
        "-F", "p",  # Plain text format
        "-f", $BACKUP_FILE,
        "--no-owner",
        "--no-acl",
        "-v"
    )
    
    & pg_dump $pgDumpArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Backup criado com sucesso!" -ForegroundColor Green
        
        # Obter tamanho do arquivo
        $fileSize = (Get-Item $BACKUP_FILE).Length / 1MB
        Write-Host "✓ Tamanho do backup: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Green
        
        # Comprimir o backup (opcional)
        Write-Host "`nComprimindo backup..." -ForegroundColor Cyan
        Compress-Archive -Path $BACKUP_FILE -DestinationPath "$BACKUP_COMPRESSED.zip" -Force
        
        if (Test-Path "$BACKUP_COMPRESSED.zip") {
            $compressedSize = (Get-Item "$BACKUP_COMPRESSED.zip").Length / 1MB
            Write-Host "✓ Backup comprimido: $([math]::Round($compressedSize, 2)) MB" -ForegroundColor Green
            Write-Host "✓ Arquivo: $BACKUP_COMPRESSED.zip" -ForegroundColor Green
        }
        
        Write-Host "`n=== Backup concluído com sucesso! ===" -ForegroundColor Green
        Write-Host "Arquivos salvos em: $BACKUP_DIR" -ForegroundColor Yellow
        
    } else {
        Write-Host "`n✗ Erro ao criar backup!" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "`n✗ Erro: $_" -ForegroundColor Red
    exit 1
} finally {
    # Limpar variável de ambiente de senha
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

# Listar backups existentes
Write-Host "`n=== Backups Disponíveis ===" -ForegroundColor Cyan
Get-ChildItem -Path $BACKUP_DIR -Filter "backup_*.sql*" | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object -First 10 Name, @{Name="Tamanho (MB)";Expression={[math]::Round($_.Length / 1MB, 2)}}, LastWriteTime | 
    Format-Table -AutoSize
