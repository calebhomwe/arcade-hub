# Rebuilds the isolated staleness harness from the real worker and proves that a deployed
# change reaches an installed client (stale-while-revalidate) instead of being pinned by the cache.
$ErrorActionPreference='SilentlyContinue'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$node = 'C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe'
$dir = Join-Path $PSScriptRoot '..\staleness'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
Copy-Item (Join-Path $repo 'games\chess-sw.js') (Join-Path $dir 'sw.js') -Force
Set-Content -Path (Join-Path $dir 'stub.js') -Value 'VERSION_ONE' -NoNewline
$d = Get-NetTCPConnection -State Listen -LocalPort 8137 -ErrorAction SilentlyContinue
if ($d) { Stop-Process -Id $d.OwningProcess -Force; Start-Sleep -Seconds 1 }
$srv = Start-Process -FilePath $node -ArgumentList @((Join-Path $PSScriptRoot 'serve8137.js')) -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
Push-Location $PSScriptRoot
& $node cdp-swr.js 'http://127.0.0.1:8137/_loop/staleness/index.html'
Pop-Location
Stop-Process -Id $srv.Id -Force