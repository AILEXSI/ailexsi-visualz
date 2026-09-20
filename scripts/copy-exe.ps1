# Copy the Tauri release exe to the repo root. Does not require the NSIS installer.
# Status lines use single-quoted strings so Windows PowerShell does not
# parse parentheses as expressions.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$product = 'AILEXSI Visualz'
$release = Join-Path $repo 'src-tauri\target\release'
$dest = Join-Path $repo ($product + '.exe')

$candidates = @(
  (Join-Path $release ($product + '.exe')),
  (Join-Path $release 'ailexsi-visualz.exe')
)

$found = $null
foreach ($c in $candidates) {
  if (Test-Path -LiteralPath $c) {
    $found = $c
    break
  }
}

if (-not $found) {
  Write-Error ('Release exe not found under ' + $release + '. Run tauri build first.')
  exit 1
}

Copy-Item -LiteralPath $found -Destination $dest -Force
Write-Host ('Copied: ' + $found)
Write-Host ('To:     ' + $dest)

$nsisDir = Join-Path $release 'bundle\nsis'
if (Test-Path -LiteralPath $nsisDir) {
  $nsis = Get-ChildItem -LiteralPath $nsisDir -Filter '*.exe' -ErrorAction SilentlyContinue
  if ($nsis) {
    foreach ($item in $nsis) {
      Write-Host ('NSIS installer not copied: ' + $item.FullName)
    }
  } else {
    Write-Host 'NSIS installer: directory exists, no .exe - ok'
  }
} else {
  Write-Host 'NSIS installer: not present - ok'
}
