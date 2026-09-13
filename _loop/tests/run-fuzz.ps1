# Chaos fuzz: throws 1500 randomised interactions (pointer, touch, keys, every button, selects,
# checkboxes, move-list rows, and junk into the PGN/FEN parsers) at the game and fails if any
# uncaught error fires or the game stops responding.
$ErrorActionPreference='SilentlyContinue'
$node = 'C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node.exe'
$d = Get-NetTCPConnection -State Listen -LocalPort 8137 -ErrorAction SilentlyContinue
if ($d) { Stop-Process -Id $d.OwningProcess -Force; Start-Sleep -Seconds 1 }
$srv = Start-Process -FilePath $node -ArgumentList @((Join-Path $PSScriptRoot 'serve8137.js')) -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
Push-Location $PSScriptRoot
$expr = Get-Content (Join-Path $PSScriptRoot 'fuzz.txt') -Raw
& $node cdp-eval.js 'http://127.0.0.1:8137/games/chess.html?nomenu' $expr '' 20000
Write-Output '--- phone viewport with touch ---'
& $node cdp-iphone.js 'http://127.0.0.1:8137/games/chess.html?nomenu' 'fuzzphone.png' 393 852 'fuzz.txt'
Pop-Location
Stop-Process -Id $srv.Id -Force