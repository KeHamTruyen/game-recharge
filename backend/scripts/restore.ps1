$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
  throw "DATABASE_URL is required."
}
if (-not $args[0]) {
  throw "Usage: npm run db:restore -- path\to\backup.dump"
}
if (-not (Test-Path -LiteralPath $args[0])) {
  throw "Backup file not found: $($args[0])"
}

pg_restore --clean --if-exists --no-owner --dbname=$env:DATABASE_URL $args[0]
Write-Output "Database restored from: $($args[0])"
