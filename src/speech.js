// Riconoscimento e sintesi vocale tramite Web Speech API del browser.

export class Voice {
  constructor() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.Recognition = SR || null;
    this.synthSupported = 'speechSynthesis' in window;
    this.recognition = null;
    this.listening = false;
    this.wantContinuous = false;
    this.lang = 'it-IT';
    this.onTranscript = null;
    this.onError = null;
    this.onState = null;
    this._manualStop = false;

    if (this.synthSupported) {
      // Su alcuni browser la lista voci arrive in modo asincrono.
      window.speechSynthesis.addEventListener?.('voiceschanged', () => {});
    }
  }

  setLang(code) {
    this.lang = code || 'it-IT';
    if (this.recognition) {
      try { this.recognition.lang = this.lang; } catch { /* ignora */ }
    }
  }

  start(continuous = this.wantContinuous) {
    if (!this.Recognition) {
      this.onError?.('unsupported');
      return false;
    }
    if (this.listening) return true;

    this._manualStop = false;
    this.wantContinuous = !!continuous;

    let r;
    try {
      r = new this.Recognition();
    } catch {
      this.onError?.('unsupported');
      return false;
    }

    r.lang = this.lang;
    r.continuous = true;
    r.interimResults = false;
    r.maxAlternatives = 1;

    r.onstart = () => {
      this.listening = true;
      this.onState?.(true);
    };

    r.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (!result.isFinal) continue;
        const text = (result[0]?.transcript || '').trim();
        if (text) this.onTranscript?.(text);
      }
    };

    r.onerror = (event) => {
      this.onError?.(event.error || 'unknown');
    };

    r.onend = () => {
      this.listening = false;
      this.onState?.(false);
      if (!this._manualStop && this.wantContinuous) {
        // Chrome a volte chiude il riconoscimento dopo un po' di silenzio.
        window.setTimeout(() => {
          if (!this._manualStop && this.wantContinuous) this.start(true);
        }, 400);
      }
    };

    this.recognition = r;
    try {
      r.start();
      return true;
    } catch {
      this.onError?.('already-started');
      return false;
    }
  }

  stop() {
    this._manualStop = true;
    this.wantContinuous = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ignora */ }
    }
    this.listening = false;
    this.onState?.(false);
  }

  toggle() {
    if (this.listening) this.stop();
    else this.start();
  }

  _pickVoice(lang) {
    const voices = window.speechSynthesis.getVoices() || [];
    const base = (lang || '').slice(0, 2).toLowerCase();
    const normalized = voices.map((v) => ({ v, l: (v.lang || '').toLowerCase().replace('_', '-') }));
    return (normalized.find(({ v, l }) => l.startsWith(base) && v.localService) ||
      normalized.find(({ l }) => l.startsWith(base)))?.v || null;
  }

  speak(text, { lang = 'it-IT', rate = 1 } = {}) {
    if (!this.synthSupported || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = rate;
      utterance.pitch = 1;
      const voice = this._pickVoice(lang);
      if (voice) utterance.voice = voice;
      window.speechSynthesis.speak(utterance);
    } catch {
      // La sintesi vocale è opzionale: non blocca il gioco.
    }
  }

  stopSpeaking() {
    if (this.synthSupported) {
      try { window.speechSynthesis.cancel(); } catch { /* ignora */ }
    }
  }
}
