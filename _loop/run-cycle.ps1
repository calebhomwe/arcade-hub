$repo = 'C:\Users\caleb\AppData\Local\arcade-hub'
$exe = 'C:\Users\caleb\nodejs\node-v24.18.0-win-x64\node_modules\opencode-ai\bin\opencode.exe'
$log = Join-Path $repo '_loop\cron.log'
$lock = Join-Path $repo '_loop\lock'
if (Test-Path (Join-Path 'C:\AI\fable\brain' 'PAUSE')) { exit 0 }
if (Test-Path (Join-Path $repo '_loop\PAUSE')) { exit 0 }
if (Test-Path (Join-Path $repo '_loop\DONE.txt')) { & schtasks /Change /TN ArcadeJuiceLoop /Disable 2>$null | Out-Null; exit 0 }
if (Test-Path $lock) {
  $age = (Get-Date) - (Get-Item $lock).LastWriteTime
  if ($age.TotalMinutes -lt 35) { exit 0 }
}
Set-Content -Path $lock -Value (Get-Date -Format o)
Add-Content $log "[$(Get-Date -Format o)] START"
Set-Location $repo
try {
  $today = (Get-Date).ToString('yyyy-MM-dd')
  $stFile = Join-Path $repo '_loop\state.json'
  if (Test-Path $stFile) { $st = Get-Content $stFile -Raw | ConvertFrom-Json } else { $st = [pscustomobject]@{ day = $today; cycles = 0 } }
  if ($st.day -ne $today) { $st.day = $today; $st.cycles = 0 }
  $max = 96
  try { $max = [int]((Get-Content (Join-Path $repo '_loop\budget.json') -Raw | ConvertFrom-Json).max_cycles_per_day) } catch {}
  if ($st.cycles -ge $max) { exit 0 }
  $prompt = "Continue the Arcade Juice Grind. Read and follow C:\Users\caleb\AppData\Local\arcade-hub\_loop\CONTRACT.md EXACTLY: take the lowest pending task in _loop\queue.jsonl, make the improvement in that game, verify headless (zero Uncaught + non-blank screenshot), update queue+ledger, git commit AND git push. One cycle only, then stop. Do NOT touch _loop\state.json."
  $before = (git -C $repo rev-parse HEAD) 2>$null
  $tmpOut = Join-Path $env:TEMP "aj-out.txt"; $tmpErr = Join-Path $env:TEMP "aj-err.txt"
  $p = Start-Process -FilePath $exe -ArgumentList @('run','-m','alibaba-token-plan/qwen3.8-flash','--title','arcade-juice-cycle',$prompt) -NoNewWindow -PassThru -RedirectStandardOutput $tmpOut -RedirectStandardError $tmpErr
  $exited = $p.WaitForExit(1200000)
  if (-not $exited) {
    Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
    Add-Content $log "[$(Get-Date -Format o)] CYCLE-TIMEOUT killed after 20min"
  } else {
    $after = (git -C $repo rev-parse HEAD) 2>$null
    if ($before -eq $after) {
      $out = if ((Get-Item $tmpOut).Length -gt 0) { (Get-Content $tmpOut -Raw) } else { '<no output>' }
      Add-Content $log "[$(Get-Date -Format o)] CYCLE-NOOP no new commit. tail: $($out.Substring([Math]::Max(0,$out.Length-500)))"
    } else { Add-Content $log "[$(Get-Date -Format o)] CYCLE-OK $before -> $after" }
  }
  $st.cycles += 1
  $st | ConvertTo-Json | Set-Content $stFile
} finally {
  Remove-Item $lock -ErrorAction SilentlyContinue
}
