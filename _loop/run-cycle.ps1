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
  $budgetFile = Join-Path $repo '_loop\budget.json'
  $b = Get-Content $budgetFile -Raw | ConvertFrom-Json
  $today = (Get-Date).ToString('yyyy-MM-dd')
  $stFile = Join-Path $repo '_loop\state.json'
  if (Test-Path $stFile) { $st = Get-Content $stFile -Raw | ConvertFrom-Json } else { $st = [pscustomobject]@{ day = $today; cycles = 0 } }
  if ($st.day -ne $today) { $st.day = $today; $st.cycles = 0 }
  if ($st.cycles -ge $b.max_cycles_per_day) { exit 0 }
  $prompt = "Continue the Arcade Juice Grind. Read and follow C:\Users\caleb\AppData\Local\arcade-hub\_loop\CONTRACT.md EXACTLY: take the lowest pending task in _loop\queue.jsonl, make the improvement in that game, verify headless (zero Uncaught + non-blank screenshot view), update queue+ledger, git commit AND git push. Then increment cycles in _loop\state.json and commit it too. One cycle only, then stop."
  $before = (git -C $repo rev-parse HEAD) 2>$null
  $out = & $exe run -m alibaba-token-plan/qwen3.8-flash --title "arcade-juice-cycle" $prompt 2>&1 | Out-String
  $after = (git -C $repo rev-parse HEAD) 2>$null
  if ($before -eq $after) { Add-Content $log "[$(Get-Date -Format o)] CYCLE-NOOP agent finished without a new commit - claims untrusted. tail: $($out.Substring([Math]::Max(0,$out.Length-400)))" }
  else { Add-Content $log "[$(Get-Date -Format o)] CYCLE-OK $before -> $after" }
} finally {
  Remove-Item $lock -ErrorAction SilentlyContinue
}
