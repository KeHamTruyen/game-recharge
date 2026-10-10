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

$databaseUrl = & node -e "const u = new URL(process.env.DATABASE_URL); u.searchParams.delete('schema'); process.stdout.write(u.toString());"
if ($LASTEXITCODE -ne 0) { throw "Invalid DATABASE_URL." }
pg_restore --exit-on-error --single-transaction --clean --if-exists --no-owner --dbname=$databaseUrl $args[0]
if ($LASTEXITCODE -ne 0) { throw "Restore failed. Changes have been rolled back." }
Write-Output "Database restored from: $($args[0])"
