(function () {
  'use strict';
  if (!window.ChessMods) return;
  let ctx = null;
  let noiseBuf = null;
  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function noise() {
    const c = ac();
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return noiseBuf;
  }
  function play(o) {
    if (typeof muted !== 'undefined' && muted) return;
    if (typeof juiceLevel !== 'undefined' && juiceLevel === 0) return;
    const vol = (o.vol || 0.1) * ((typeof juiceLevel !== 'undefined' ? juiceLevel : 50) / 100 + 0.3);
    try {
      const c = ac(); const t = c.currentTime + (o.at || 0);
      if (o.src === 'noise') {
        const s = c.createBufferSource(); s.buffer = noise();
        const f = c.createBiquadFilter(); f.type = o.filter || 'bandpass';
        f.frequency.setValueAtTime(o.freq || 800, t);
        if (o.slideTo) f.frequency.exponentialRampToValueAtTime(o.slideTo, t + o.dur);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
        s.connect(f); f.connect(g); g.connect(c.destination);
        s.start(t); s.stop(t + o.dur + 0.05);
      } else {
        const s = c.createOscillator(); s.type = o.type || 'sine';
        s.frequency.setValueAtTime(o.freq, t);
        if (o.slideTo) s.frequency.exponentialRampToValueAtTime(o.slideTo, t + o.dur);
        const g = c.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
        s.connect(g); g.connect(c.destination);
        s.start(t); s.stop(t + o.dur + 0.05);
      }
    } catch (e) {}
  }
  function valOf(p) { return (typeof VAL !== 'undefined' && p) ? (VAL[pType(p)] || 1) : 1; }
  ChessMods.on('move', function (m) {
    try {
      play({ src: 'noise', filter: 'bandpass', freq: 500 + valOf(m.captured || 4) * 120, slideTo: 2200, dur: 0.12, vol: 0.06 });
      if (m.captured) {
        play({ type: 'sine', freq: 160, slideTo: 55, dur: 0.22, vol: 0.2 });
        play({ src: 'noise', filter: 'highpass', freq: 3000, dur: 0.12, vol: 0.08, at: 0.01 });
        if (valOf(m.captured) >= 5) play({ type: 'sine', freq: 70, slideTo: 38, dur: 0.4, vol: 0.28, at: 0.02 });
      }
      if (m.check) { play({ type: 'square', freq: 880, dur: 0.08, vol: 0.07 }); play({ type: 'square', freq: 1100, dur: 0.1, vol: 0.07, at: 0.1 }); }
      if (m.castle) { play({ type: 'sine', freq: 220, slideTo: 140, dur: 0.09, vol: 0.12 }); play({ type: 'sine', freq: 200, slideTo: 130, dur: 0.09, vol: 0.12, at: 0.11 }); }
      if (m.promo) { [440, 554, 659, 880].forEach((f, i) => play({ type: 'triangle', freq: f, dur: 0.16, vol: 0.1, at: i * 0.07 })); play({ src: 'noise', filter: 'highpass', freq: 5000, dur: 0.5, vol: 0.05 }); }
      if (m.combo >= 3) play({ type: 'sawtooth', freq: 400 + m.combo * 120, slideTo: 900 + m.combo * 150, dur: 0.14, vol: 0.08 });
      if (m.mate) {
        play({ type: 'sawtooth', freq: 220, dur: 0.5, vol: 0.14 });
        play({ type: 'sawtooth', freq: 233, dur: 0.5, vol: 0.14 });
        play({ src: 'noise', filter: 'bandpass', freq: 900, slideTo: 1600, dur: 1.2, vol: 0.1, at: 0.3 });
      }
    } catch (e) { console.warn('[chess-sfx]', e); }
  });
})();
