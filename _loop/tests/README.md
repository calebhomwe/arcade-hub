# Chess test harnesses

Run the in-page regression suite (window.__chessTest) headlessly, one Chrome per case.

1. Start the static server for the repo root:
   node _loop/shots/serve8137.js          (listens on 127.0.0.1:8137; run it from anywhere)

2. Run every case:
   pwsh: for each id in kingrook kingside queenside rooktap blackcastle refuse puzzle8 traps acad keyboard perft
     & "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --mute-audio `
       --window-size=500,900 --virtual-time-budget=25000 --dump-dom `
       "http://127.0.0.1:8137/_loop/shots/selftest.html?case=<id>"
   The page prints <pre>PROBERESULT {...} ENDRESULT</pre>; parse that JSON.

3. Or drive the DEPLOYED build (GitHub Pages) the same way with livecase.html?case=<id>.

cdp.js + minws.js are a dependency-free CDP driver (real Chrome, real event dispatch) if you need
screenshots or richer interaction; note MiniWS requires an explicit ws.connect() call.

The suite itself lives in games/chess.html (search for __chessTest) so it ships with the game:
open the game in a console and run window.__chessTest() to check everything at once.
