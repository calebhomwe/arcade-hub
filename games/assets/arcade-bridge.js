(function(){
'use strict';
function el(sel){return sel?document.querySelector(sel):null;}
function visible(node){if(!node){return false;}if(node.classList&&node.classList.contains('hidden')){return false;}var st=window.getComputedStyle(node);return st.display!=='none'&&st.visibility!=='hidden'&&st.opacity!=='0';}
function textScore(sel){var n=el(sel);if(!n){return 0;}var t=(n.textContent||'').replace(/[^\d.-]/g,'');var v=parseFloat(t);return isFinite(v)?v:0;}
function toast(msg){if(!msg){return;}var t=document.createElement('div');t.textContent=msg;t.style.cssText='position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:99999;background:rgba(10,14,24,.92);color:#fff;padding:10px 14px;border-radius:10px;font:600 13px system-ui;box-shadow:0 8px 20px rgba(0,0,0,.35)';document.body.appendChild(t);setTimeout(function(){t.remove();},1800);} 
function click(sel){var n=el(sel);if(!n){return false;}try{n.click();return true;}catch(e){return false;}}
function autoTap(sel,times,gap){var n=el(sel);if(!n){return false;}var i=0,max=Math.max(1,times||120),g=Math.max(8,gap||12);var id=setInterval(function(){try{if(n.click){n.click();}else{n.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));n.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));}}catch(e){}if(++i>=max){clearInterval(id);}},g);return true;}
function promptCode(){try{return (window.prompt('Enter cheat code')||'').trim();}catch(e){return '';}}
function mathHint(sel){var t=((el(sel)||{}).textContent||'').replace(/\s+/g,' ').trim();var m=t.match(/(-?\d+)\s*([+\-×x÷\*\/])\s*(-?\d+)/);if(!m){return 'Break the problem into smaller steps and estimate first.';}var a=+m[1],op=m[2],b=+m[3],ans=0;if(op==='+' )ans=a+b;else if(op==='-')ans=a-b;else if(op==='×'||op==='x'||op==='*')ans=a*b;else if(op==='÷'||op==='/')ans=b?Math.round((a/b)*100)/100:0;var lo=Math.floor(ans)-2,hi=Math.ceil(ans)+2;if(op==='+'||op==='-'){return 'Count on carefully. The answer is between '+lo+' and '+hi+'.';}if(op==='×'||op==='x'||op==='*'){return 'Use repeated groups: '+a+' groups of '+b+'. Answer is near '+ans+'.';}return 'Think inverse: what number times '+b+' gives '+a+'?';}
function setup(cfg){
 if(!cfg||!window.ArcadeSDK){return;}
 var stateKey='arcade_tutorial_seen_'+cfg.gameId;
 var codesOn=false;
 function scene(){if(typeof cfg.sceneResolver==='function'){return cfg.sceneResolver();}if(visible(el(cfg.overSelector))){return 'over';}if(visible(el(cfg.playSelector))&&!visible(el(cfg.titleSelector))){return 'play';}return 'title';}
 function score(){return textScore(cfg.scoreSelector);}
 function report(){if(window.ArcadeSDK&&window.ArcadeSDK.state){window.ArcadeSDK.state({scene:scene(),score:score()});}}
 function labelCodesOn(){if(!cfg.codesOnLabel||!codesOn){return;}if(document.getElementById('arcadeCodesOn')){return;}var b=document.createElement('div');b.id='arcadeCodesOn';b.textContent='CODES ON';b.style.cssText='position:fixed;left:10px;bottom:10px;z-index:99998;background:#7f1d1d;color:#fff;padding:6px 10px;border-radius:9px;font:800 12px system-ui;letter-spacing:.6px';document.body.appendChild(b);} 
 function showTutorial(force){
   var seen=false;try{seen=localStorage.getItem(stateKey)==='1';}catch(e){}
   if(seen&&!force){return;}
   var box=document.createElement('div');
   box.style.cssText='position:fixed;inset:0;z-index:99997;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;padding:16px';
   box.innerHTML='<div style="max-width:460px;background:#0f172a;color:#e2e8f0;border:1px solid rgba(148,163,184,.4);border-radius:14px;padding:16px;font:500 14px system-ui"><div style="font-weight:800;margin-bottom:8px">Quick tutorial</div><div style="line-height:1.5">'+(cfg.tutorialText||'Learn the core action and try one move.')+'</div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button id="abSkip" style="padding:8px 10px;border-radius:8px;border:1px solid #475569;background:#0f172a;color:#cbd5e1">Skip</button><button id="abTry" style="padding:8px 10px;border-radius:8px;border:1px solid #22d3ee;background:#155e75;color:#ecfeff">Got it</button></div></div>';
   document.body.appendChild(box);
   var done=function(){try{localStorage.setItem(stateKey,'1');}catch(e){}box.remove();};
   box.querySelector('#abSkip').addEventListener('click',done);
   box.querySelector('#abTry').addEventListener('click',function(){done();if(cfg.tutorialButtonSelector){click(cfg.tutorialButtonSelector);}});
 }
 var last='';
 var obs=new MutationObserver(function(){report();});
 var sceneNodes=[el(cfg.titleSelector),el(cfg.playSelector),el(cfg.overSelector)];
 for(var s=0;s<sceneNodes.length;s++){
   if(sceneNodes[s]){obs.observe(sceneNodes[s],{attributes:true,attributeFilter:['class','style']});}
 }
 var pollId=setInterval(function(){var now=scene()+':'+score();if(now!==last){last=now;report();}},700);
 function stopPoll(){if(pollId){clearInterval(pollId);pollId=0;}}
 window.addEventListener('pagehide',stopPoll,{once:true});
 window.addEventListener('beforeunload',stopPoll,{once:true});
 if(window.ArcadeSDK&&window.ArcadeSDK.init){
   window.ArcadeSDK.init({
     onRestart:function(){if(typeof cfg.onRestart==='function'){if(cfg.onRestart({click:click,toast:toast,autoTap:autoTap})===true){return;}}if(cfg.restartSelector){click(cfg.restartSelector);}else if(cfg.tutorialButtonSelector){click(cfg.tutorialButtonSelector);}report();},
     onExit:function(){
       if(typeof cfg.onExit==='function'){
         if(cfg.onExit({click:click,toast:toast,autoTap:autoTap})===true){report();return;}
       }
       var done=cfg.exitSelector?click(cfg.exitSelector):false;
       if(!done&&cfg.titleSelector){
         var title=el(cfg.titleSelector);
         if(title){
           if(title.classList&&title.classList.contains('screen')){
             var screens=document.querySelectorAll('.screen');
             for(var i=0;i<screens.length;i++){screens[i].classList.remove('s-active');}
             title.classList.add('s-active');
           }else if(title.classList&&title.classList.contains('overlay')){
             title.classList.remove('hidden');
           }
         }
       }
       report();
     },
     onTutorial:function(){showTutorial(true);},
     onHint:function(){if(typeof cfg.onHint==='function'){cfg.onHint(mathHint,toast);return;}if(cfg.hintSelector&&click(cfg.hintSelector)){return;}toast('Try one small step first, then check your result.');},
     onCheat:cfg.onCheat?function(code){var c=String(code||'').trim();if(!c){c=promptCode();}if(!c){return;}if(cfg.onCheat(c,{click:click,toast:toast,autoTap:autoTap,mathHint:mathHint})){codesOn=true;labelCodesOn();}}:undefined,
     pauseButton:cfg.pauseButton||'tr'
   });
 }
 setTimeout(function(){showTutorial(false);report();},350);
}
window.ArcadeBridge={setup:setup,mathHint:mathHint};
})();
