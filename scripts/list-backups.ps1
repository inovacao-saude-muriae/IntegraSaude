# Script para listar e gerenciar backups do banco de dados
# Uso: .\scripts\list-backups.ps1

$BACKUP_DIR = "backups"

Write-Host "`n=== Backups do IntegraSaúde ===" -ForegroundColor Cyan
Write-Host ""

if (-not (Test-Path $BACKUP_DIR)) {
    Write-Host "⚠️  Nenhum backup encontrado. Diretório '$BACKUP_DIR' não existe." -ForegroundColor Yellow
    Write-Host "`nPara criar um backup, execute:" -ForegroundColor Cyan
    Write-Host "  .\scripts\backup-database.ps1" -ForegroundColor White
    exit 0
}

# Listar todos os backups
$backups = Get-ChildItem -Path $BACKUP_DIR -Filter "backup_*.sql*" | 
    Sort-Object LastWriteTime -Descending

if ($backups.Count -eq 0) {
    Write-Host "⚠️  Nenhum backup encontrado em '$BACKUP_DIR'" -ForegroundColor Yellow
    Write-Host "`nPara criar um backup, execute:" -ForegroundColor Cyan
    Write-Host "  .\scripts\backup-database.ps1" -ForegroundColor White
    exit 0
}

# Exibir backups em tabela
$backups | Select-Object @{
    Name='#';
    Expression={ $backups.IndexOf($_) + 1 }
}, @{
    Name='Arquivo';
    Expression={ $_.Name }
}, @{
    Name='Tamanho';
    Expression={ 
        if ($_.Length -lt 1MB) {
            "$([math]::Round($_.Length / 1KB, 2)) KB"
        } else {
            "$([math]::Round($_.Length / 1MB, 2)) MB"
        }
    }
}, @{
    Name='Data/Hora';
    Expression={ $_.LastWriteTime.ToString("dd/MM/yyyy HH:mm:ss") }
}, @{
    Name='Dias atrás';
    Expression={ [math]::Floor((Get-Date - $_.LastWriteTime).TotalDays) }
} | Format-Table -AutoSize

# Estatísticas
$totalSize = ($backups | Measure-Object -Property Length -Sum).Sum
$oldestBackup = ($backups | Sort-Object LastWriteTime | Select-Object -First 1).LastWriteTime
$newestBackup = ($backups | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime

Write-Host "=== Estatísticas ===" -ForegroundColor Cyan
Write-Host "Total de backups: $($backups.Count)" -ForegroundColor White
Write-Host "Espaço ocupado: $([math]::Round($totalSize / 1MB, 2)) MB" -ForegroundColor White
Write-Host "Backup mais antigo: $($oldestBackup.ToString('dd/MM/yyyy HH:mm:ss'))" -ForegroundColor White
Write-Host "Backup mais recente: $($newestBackup.ToString('dd/MM/yyyy HH:mm:ss'))" -ForegroundColor White
Write-Host ""

# Menu de opções
Write-Host "=== Opções ===" -ForegroundColor Cyan
Write-Host "[1] Criar novo backup" -ForegroundColor White
Write-Host "[2] Restaurar um backup" -ForegroundColor White
Write-Host "[3] Limpar backups antigos (>30 dias)" -ForegroundColor White
Write-Host "[4] Sair" -ForegroundColor White
Write-Host ""

$choice = Read-Host "Escolha uma opção"

switch ($choice) {
    "1" {
        Write-Host "`nCriando novo backup..." -ForegroundColor Cyan
        & "$PSScriptRoot\backup-database.ps1"
    }
    "2" {
        Write-Host ""
        $backupNumber = Read-Host "Digite o número do backup que deseja restaurar"
        
        if ($backupNumber -match '^\d+$' -and [int]$backupNumber -ge 1 -and [int]$backupNumber -le $backups.Count) {
            $selectedBackup = $backups[[int]$backupNumber - 1]
            Write-Host "`nRestaurando backup: $($selectedBackup.Name)" -ForegroundColor Yellow
            & "$PSScriptRoot\restore-database.ps1" -BackupFile "$BACKUP_DIR\$($selectedBackup.Name)"
        } else {
            Write-Host "✗ Número inválido!" -ForegroundColor Red
        }
    }
    "3" {
        Write-Host ""
        $oldBackups = Get-ChildItem -Path $BACKUP_DIR -Filter "backup_*.sql*" | 
            Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-30) }
        
        if ($oldBackups.Count -eq 0) {
            Write-Host "✓ Nenhum backup antigo (>30 dias) encontrado." -ForegroundColor Green
        } else {
            Write-Host "Backups a serem removidos:" -ForegroundColor Yellow
            $oldBackups | ForEach-Object { Write-Host "  - $($_.Name)" -ForegroundColor White }
            
            $confirm = Read-Host "`nConfirma a remoção? (S/N)"
            if ($confirm -eq 'S' -or $confirm -eq 's') {
                $oldBackups | Remove-Item -Force
                Write-Host "✓ $($oldBackups.Count) backup(s) removido(s)!" -ForegroundColor Green
            } else {
                Write-Host "Operação cancelada." -ForegroundColor Yellow
            }
        }
    }
    "4" {
        Write-Host "Saindo..." -ForegroundColor Yellow
    }
    default {
        Write-Host "✗ Opção inválida!" -ForegroundColor Red
    }
}
