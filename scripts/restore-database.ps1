# Script de Restauração do Banco de Dados PostgreSQL - IntegraSaúde
# Uso: .\scripts\restore-database.ps1 -BackupFile "caminho/do/backup.sql"

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

# Configurações do banco
$DB_HOST = "100.82.145.85"
$DB_PORT = "5433"
$DB_NAME = "orion"
$DB_USER = "admin"
$DB_PASSWORD = "minhasenhalocal"

# Verificar se o arquivo existe
if (-not (Test-Path $BackupFile)) {
    Write-Host "✗ Erro: Arquivo de backup não encontrado: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== Restauração do Banco de Dados IntegraSaúde ===" -ForegroundColor Cyan
Write-Host "Banco: $DB_NAME" -ForegroundColor Yellow
Write-Host "Host: $DB_HOST`:$DB_PORT" -ForegroundColor Yellow
Write-Host "Arquivo: $BackupFile" -ForegroundColor Yellow
Write-Host ""

# Confirmação
$confirmation = Read-Host "⚠️  ATENÇÃO: Esta operação irá SOBRESCREVER todos os dados atuais do banco! Deseja continuar? (S/N)"
if ($confirmation -ne 'S' -and $confirmation -ne 's') {
    Write-Host "Operação cancelada pelo usuário." -ForegroundColor Yellow
    exit 0
}

# Definir senha como variável de ambiente
$env:PGPASSWORD = $DB_PASSWORD

try {
    Write-Host "`nRestaurando backup..." -ForegroundColor Cyan
    
    # Se o arquivo estiver comprimido, descomprimir primeiro
    $fileToRestore = $BackupFile
    if ($BackupFile -like "*.zip") {
        Write-Host "Descomprimindo arquivo..." -ForegroundColor Cyan
        $tempFile = [System.IO.Path]::GetTempFileName() + ".sql"
        Expand-Archive -Path $BackupFile -DestinationPath (Split-Path $tempFile) -Force
        $fileToRestore = $tempFile
    }
    
    # Executar psql para restaurar
    $psqlArgs = @(
        "-h", $DB_HOST,
        "-p", $DB_PORT,
        "-U", $DB_USER,
        "-d", $DB_NAME,
        "-f", $fileToRestore
    )
    
    & psql $psqlArgs
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "`n✓ Banco de dados restaurado com sucesso!" -ForegroundColor Green
        Write-Host "`n=== Restauração concluída! ===" -ForegroundColor Green
    } else {
        Write-Host "`n✗ Erro ao restaurar banco de dados!" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "`n✗ Erro: $_" -ForegroundColor Red
    exit 1
} finally {
    # Limpar variável de ambiente de senha
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
    
    # Remover arquivo temporário se foi criado
    if ($fileToRestore -ne $BackupFile -and (Test-Path $fileToRestore)) {
        Remove-Item $fileToRestore -Force
    }
}
