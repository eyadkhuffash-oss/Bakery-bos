// مولّد نغمات بسيط عبر Web Audio API — لا يحتاج ملفات صوت ولا إنترنت
const Sounds = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, duration, delay = 0, type = 'sine', volume = 0.25) {
    const c = getCtx();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(c.destination);
    const start = c.currentTime + delay;
    osc.start(start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.stop(start + duration + 0.02);
  }

  return {
    // صوت إضافة صنف للسلة: نغمة قصيرة خفيفة
    tap() { tone(880, 0.06, 0, 'sine', 0.12); },

    // صوت إرسال طلبية بنجاح
    sent() {
      tone(660, 0.1, 0);
      tone(990, 0.15, 0.12);
    },

    // تنبيه طلبية جديدة عند الخباز: نغمتين واضحتين متكررة
    newOrder() {
      tone(523.25, 0.18, 0, 'triangle', 0.3);
      tone(659.25, 0.22, 0.2, 'triangle', 0.3);
      tone(783.99, 0.28, 0.42, 'triangle', 0.32);
    },

    // تنبيه عند الكاشير أن طلبية أصبحت جاهزة
    ready() {
      tone(880, 0.15, 0, 'sine', 0.28);
      tone(1108.73, 0.2, 0.16, 'sine', 0.28);
    },

    error() {
      tone(220, 0.25, 0, 'sawtooth', 0.2);
    }
  };
})();
