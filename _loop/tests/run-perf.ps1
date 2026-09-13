# Measures the performance budget over CDP and fails loudly when a line is exceeded.
$ErrorActionPreference='SilentlyContinue'
$node = 'C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe'
$d = Get-NetTCPConnection -State Listen -LocalPort 8137 -ErrorAction SilentlyContinue
if ($d) { Stop-Process -Id $d.OwningProcess -Force; Start-Sleep -Seconds 1 }
$srv = Start-Process -FilePath $node -ArgumentList @((Join-Path $PSScriptRoot 'serve8137.js')) -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
Push-Location $PSScriptRoot
& $node cdp-perf.js 'http://127.0.0.1:8137/games/chess.html?nomenu'
Pop-Location
Stop-Process -Id $srv.Id -Force