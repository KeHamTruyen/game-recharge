$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is required."
}

$backupDirectory = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$fileName = "nexatopup-$((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')).dump"
$outputPath = Join-Path $backupDirectory $fileName

pg_dump --format=custom --no-owner --file=$outputPath $env:DATABASE_URL
Write-Output "Backup created: $outputPath"
