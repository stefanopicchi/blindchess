// Wrapper UCI attorno a Stockfish 17.1 in WebAssembly (build lite single-thread).
// Nessun header COOP/COEP necessario: funziona su GitHub Pages e Cloudflare Pages.

const ENGINE_URL = new URL('../vendor/stockfish/stockfish-17.1-lite-single-03e3232.js', import.meta.url);

export class Engine {
  constructor(onStatus = () => {}) {
    this.onStatus = onStatus;
    this.failed = false;
    this.options = [];
    this.hasElo = false;
    this.hasSkill = false;
    this.readyWaiters = [];
    this.bestWaiters = [];
    this.uciDone = null;

    try {
      this.worker = new Worker(ENGINE_URL);
    } catch (error) {
      this.failed = true;
      this.onStatus('error', error);
      this.ready = Promise.resolve();
      return;
    }

    this.worker.onmessage = (event) => this._handleLine(String(event.data || ''));
    this.worker.onerror = (event) => {
      this.failed = true;
      this.onStatus('error', event);
    };

    this.ready = this._init();
  }

  _send(command) {
    if (!this.failed) this.worker.postMessage(command);
  }

  _handleLine(line) {
    if (line === 'readyok') {
      this.readyWaiters.shift()?.();
      return;
    }
    if (line.startsWith('bestmove ')) {
      const move = line.split(/\s+/)[1];
      this.bestWaiters.shift()?.(move && move !== '(none)' ? move : null);
      return;
    }
    if (line.startsWith('option ')) this.options.push(line);
    if (line === 'uciok') this.uciDone?.();
  }

  _waitReady(timeout = 15000) {
    if (this.failed) return Promise.resolve();
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve(), timeout);
      this.readyWaiters.push(() => {
        window.clearTimeout(timer);
        resolve();
      });
    });
  }

  async _init() {
    this.onStatus('loading');
    const uciReady = new Promise((resolve) => {
      this.uciDone = resolve;
      window.setTimeout(resolve, 15000);
    });

    this._send('uci');
    await uciReady;

    this.hasElo = this.options.some((o) => o.includes('UCI_Elo'));
    this.hasSkill = this.options.some((o) => o.includes('Skill Level'));

    this._send('isready');
    await this._waitReady();

    if (!this.failed) this.onStatus('ready');
  }

  async setElo(elo) {
    await this.ready;
    if (this.failed) return;
    const value = Math.max(400, Math.min(2000, Number(elo) || 800));

    // Stockfish accetta UCI_Elo solo da 1320 in su: sotto quella soglia
    // usiamo Skill Level, così i livelli principianti sono davvero più deboli.
    if (this.hasElo && value >= 1320) {
      if (this.hasSkill) this._send('setoption name Skill Level value 20');
      this._send('setoption name UCI_LimitStrength value true');
      this._send(`setoption name UCI_Elo value ${value}`);
    } else {
      if (this.hasElo) this._send('setoption name UCI_LimitStrength value false');
      if (this.hasSkill) {
        const skill = value < 1320
          ? Math.round(((value - 400) / 920) * 10)
          : 20;
        this._send(`setoption name Skill Level value ${skill}`);
      }
    }

    this._send('isready');
    await this._waitReady();
  }

  async setFullStrength() {
    await this.ready;
    if (this.failed) return;
    if (this.hasElo) this._send('setoption name UCI_LimitStrength value false');
    if (this.hasSkill) this._send('setoption name Skill Level value 20');
    this._send('isready');
    await this._waitReady();
  }

  async bestMove({ moves = [], movetime = 700 } = {}) {
    await this.ready;
    if (this.failed) return null;

    this._send('ucinewgame');
    this._send('isready');
    await this._waitReady();

    this._send(`position startpos moves ${moves.join(' ')}`);
    const think = Math.max(200, Math.round(movetime));
    this._send(`go movetime ${think}`);

    return new Promise((resolve) => {
      const timer = window.setTimeout(() => resolve(null), think + 15000);
      this.bestWaiters.push((move) => {
        window.clearTimeout(timer);
        resolve(move);
      });
    });
  }

  stop() {
    this._send('stop');
  }

  terminate() {
    try { this.worker?.terminate(); } catch { /* ignora */ }
  }
}
