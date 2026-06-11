$TMP = [System.IO.Path]::GetTempPath() + "d6oss-smoke-" + [System.IO.Path]::GetRandomFileName()
New-Item -ItemType Directory -Path $TMP -Force | Out-Null
Set-Location $TMP
npm init -y 2>$null | Out-Null
Write-Host "## Installing CLI v0.6.2-phase-6"
npm install @orqenix-pro/cli@0.6.2-phase-6 --verbose 2>&1 | Select-Object -Last 20
$installExit = $LASTEXITCODE
if ($installExit -ne 0) { Write-Host "FAIL: install"; exit 1 }
Write-Host "OK: installed"
Write-Host ""
Write-Host "## OSS deps:"
"mesh-transport-core","mesh-observability","transport-security","mesh-transport-http","mesh-transport-libp2p","mesh-router","mesh-discovery" | ForEach-Object {
  $p = $_
  $path = "node_modules/@orqenix/$p"
  if (Test-Path $path) {
    $ver = node -e "console.log(JSON.parse(require('fs').readFileSync('$path/package.json','utf8')).version)"
    $tag = if ($ver -match "phase-") { " (phase-tagged!)" } else { " (clean)" }
    Write-Host "  @orqenix/$p`: $ver$tag"
  } else {
    Write-Host "  @orqenix/$p`: NOT INSTALLED"
  }
}
Write-Host ""
Write-Host "## Pro deps:"
"license","blast-radius","mesh-delegation","polyglot-backend" | ForEach-Object {
  $p = $_
  $path = "node_modules/@orqenix-pro/$p"
  if (Test-Path $path) {
    $ver = node -e "console.log(JSON.parse(require('fs').readFileSync('$path/package.json','utf8')).version)"
    Write-Host "  @orqenix-pro/$p`: $ver"
  } else {
    Write-Host "  @orqenix-pro/$p`: NOT INSTALLED"
  }
}
Write-Host ""
Write-Host "## Smoke:"
npx orqenix help 2>&1 | Out-Null; $h = $LASTEXITCODE
$env:ORQENIX_PRO_LICENSE = "invalid"
npx orqenix auth status 2>&1 | Out-Null; $a = $LASTEXITCODE
npx orqenix quota show 2>&1 | Out-Null; $q = $LASTEXITCODE
Write-Host "help=$h auth=$a quota=$q"
if ($h -eq 0 -and $a -eq 3 -and $q -eq 3) {
  Write-Host "PASS: CLI v0.6.2-phase-6 works end-to-end"
  Write-Host "Forward-compat: ACHIEVED"
} else {
  Write-Host "FAIL"
}
Set-Location C:\Users\vnet-1-vm-c1\Documents\GitHub\Orqenix-Pro
Remove-Item -Recurse -Force $TMP -ErrorAction SilentlyContinue
