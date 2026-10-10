$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is required."
}

$backupDirectory = Join-Path (Get-Location) "backups"
New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null
$fileName = "nexatopup-$((Get-Date).ToUniversalTime().ToString('yyyyMMdd-HHmmss')).dump"
$outputPath = Join-Path $backupDirectory $fileName

$databaseUrl = & node -e "const u = new URL(process.env.DATABASE_URL); u.searchParams.delete('schema'); process.stdout.write(u.toString());"
if ($LASTEXITCODE -ne 0) { throw "Invalid DATABASE_URL." }
pg_dump --format=custom --no-owner --file=$outputPath $databaseUrl
if ($LASTEXITCODE -ne 0) { throw "Backup failed. Do not use the incomplete file: $outputPath" }
Write-Output "Backup created: $outputPath"
