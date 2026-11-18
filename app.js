import { Chess } from './vendor/chess.js';
import { Engine } from './src/engine.js';
import { BoardView } from './src/board.js';
import { Voice } from './src/speech.js';
import { parseMove, looksEnglish } from './src/move-parser.js';
import { moveToSpeech } from './src/notation.js';
import { loadSettings, saveSettings, loadStats, saveStats } from './src/storage.js';

const $ = (id) => document.getElementById(id);

const el = {
  engineStatus: $('engineStatus'),
  themeBtn: $('themeBtn'),
  eloRange: $('eloRange'),
  eloValue: $('eloValue'),
  colorSelect: $('colorSelect'),
  clockSelect: $('clockSelect'),
  voiceLangSelect: $('voiceLangSelect'),
  newGameBtn: $('newGameBtn'),
  boardToggle: $('boardToggle'),
  piecesToggle: $('piecesToggle'),
  board: $('board'),
  boardVeil: $('boardVeil'),
  boardHint: $('boardHint'),
  turnStatus: $('turnStatus'),
  clockPlayer: $('clockPlayer'),
  clockBot: $('clockBot'),
  clockPlayerLabel: $('clockPlayerLabel'),
  clockBotLabel: $('clockBotLabel'),
  botMove: $('botMove'),
  repeatBtn: $('repeatBtn'),
  micBtn: $('micBtn'),
  continuousChk: $('continuousChk'),
  heardText: $('heardText'),
  moveForm: $('moveForm'),
  moveInput: $('moveInput'),
  confirmChk: $('confirmChk'),
  undoBtn: $('undoBtn'),
  hintBtn: $('hintBtn'),
  pgnBtn: $('pgnBtn'),
  moveList: $('moveList'),
  stats: $('stats'),
  resetStatsBtn: $('resetStatsBtn'),
  toast: $('toast'),
};

let settings = loadSettings();
let stats = loadStats();
let game = new Chess();
let board;
let voice;
let engine;

let uciMoves = [];
let lastMove = null;
let botSan = '';
let botPhrase = '';
let selected = null;
let targets = [];
let thinking = false;
let hintBusy = false;
let gameOver = false;
let gameOverMessage = '';
let generation = 0;

let clocks = { w: 0, b: 0 };
let elapsed = { w: 0, b: 0 };
let lastTick = Date.now();

let toastTimer = null;

/* ------------------------------ Utility ------------------------------ */

const timeLimit = () => Number(settings.clock) || 0;
const playerName = () => (settings.color === 'w' ? 'Bianco' : 'Nero');
const botName = () => (settings.color === 'w' ? 'Nero' : 'Bianco');
const toUci = (move) => move.from + move.to + (move.promotion || '');

function toast(message, kind = '') {
  el.toast.textContent = message;
  el.toast.className = `toast is-visible${kind ? ` is-${kind}` : ''}`;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    el.toast.className = 'toast';
  }, 4200);
}

function recognitionLang() {
  if (settings.voiceLang === 'en') return 'en-US';
  return 'it-IT'; // "auto" parte dall'italiano e passa all'inglese se serve
}

function formatTime(seconds) {
  const total = Math.max(0, Math.ceil(seconds));
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function canInteract() {
  return !gameOver && !thinking && !hintBusy && game.turn() === settings.color;
}

function speak(text, lang = 'it-IT') {
  voice?.speak(text, { lang });
}

/* ------------------------------ Rendering ------------------------------ */

function renderClocks() {
  el.clockPlayerLabel.textContent = playerName();
  el.clockBotLabel.textContent = botName();

  const playerSide = settings.color;
  const botSide = playerSide === 'w' ? 'b' : 'w';
  const limited = timeLimit() > 0;

  el.clockPlayer.textContent = limited ? formatTime(clocks[playerSide]) : formatTime(elapsed[playerSide]);
  el.clockBot.textContent = limited ? formatTime(clocks[botSide]) : formatTime(elapsed[botSide]);

  el.clockPlayer.parentElement.classList.toggle('is-active', !gameOver && game.turn() === playerSide);
  el.clockBot.parentElement.classList.toggle('is-active', !gameOver && game.turn() === botSide);
  el.clockPlayer.parentElement.classList.toggle('is-low', limited && clocks[playerSide] <= 30);
  el.clockBot.parentElement.classList.toggle('is-low', limited && clocks[botSide] <= 30);
}

function renderHistory() {
  const history = game.history();
  el.moveList.replaceChildren();

  if (!history.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'Nessuna mossa';
    el.moveList.appendChild(empty);
    return;
  }

  for (let i = 0; i < history.length; i += 2) {
    const row = document.createElement('li');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = `${i / 2 + 1}.`;
    const white = document.createElement('span');
    white.className = 'w';
    white.textContent = history[i];
    const black = document.createElement('span');
    black.className = 'b';
    black.textContent = history[i + 1] || '';
    row.append(num, white, black);
    el.moveList.appendChild(row);
  }
  el.moveList.scrollTop = el.moveList.scrollHeight;
}

function renderStats() {
  const items = [
    ['Partite', stats.games],
    ['Vittorie', stats.wins],
    ['Pareggi', stats.draws],
    ['Sconfitte', stats.losses],
  ];
  el.stats.replaceChildren();
  for (const [label, value] of items) {
    const box = document.createElement('div');
    box.className = 'stat';
    const strong = document.createElement('strong');
    strong.textContent = String(value);
    const span = document.createElement('span');
    span.textContent = label;
    box.append(strong, span);
    el.stats.appendChild(box);
  }
}

function render() {
  const interactive = canInteract() && settings.showBoard;
  board.render({
    game,
    orientation: settings.color,
    showPieces: settings.showPieces,
    selected,
    targets,
    lastMove,
    interactive,
  });

  el.boardVeil.classList.toggle('is-hidden', !settings.showBoard);

  el.boardToggle.setAttribute('aria-pressed', String(settings.showBoard));
  el.boardToggle.textContent = settings.showBoard ? '👁 Scacchiera: visibile' : '👁 Scacchiera: nascosta';
  el.piecesToggle.setAttribute('aria-pressed', String(settings.showPieces));
  el.piecesToggle.textContent = settings.showPieces ? '♟ Pezzi: visibili' : '♟ Pezzi: nascosti';

  let status;
  if (gameOver) status = gameOverMessage;
  else if (thinking) status = 'Il bot sta pensando…';
  else if (hintBusy) status = 'Cerco un suggerimento…';
  else if (game.turn() === settings.color) status = `Tocca a te (${playerName()}).`;
  else status = `Tocca al bot (${botName()})…`;
  el.turnStatus.textContent = status;
  el.turnStatus.className = `status${gameOver ? (status.includes('vinto') || status.includes('Hai') ? ' is-ok' : '') : ''}`;

  el.botMove.textContent = botSan ? `${botSan} — ${botPhrase}` : '—';
  el.repeatBtn.disabled = !botPhrase;

  el.moveInput.disabled = !canInteract();
  el.micBtn.disabled = !canInteract();
  el.undoBtn.disabled = game.history().length === 0;
  el.hintBtn.disabled = !canInteract();

  if (!settings.showBoard) el.boardHint.textContent = 'Scacchiera nascosta: ascolta le mosse del bot e ricorda la posizione.';
  else if (selected) el.boardHint.textContent = 'Ora clicca la casella di destinazione.';
  else if (canInteract()) el.boardHint.textContent = 'Clicca una casella per selezionare il pezzo, poi la destinazione.';
  else el.boardHint.textContent = 'Attendi la mossa del bot…';

  renderHistory();
  renderClocks();
  renderStats();
}

/* ------------------------------ Flusso di gioco ------------------------------ */

function newGame({ announce = true } = {}) {
  generation += 1;
  engine?.stop();
  thinking = false;
  hintBusy = false;
  gameOver = false;
  gameOverMessage = '';
  selected = null;
  targets = [];
  lastMove = null;
  botSan = '';
  botPhrase = '';
  uciMoves = [];
  game.reset();

  const limit = timeLimit();
  clocks = { w: limit, b: limit };
  elapsed = { w: 0, b: 0 };
  lastTick = Date.now();

  el.heardText.textContent = 'Il testo di ciò che dici apparirà qui.';
  render();

  if (announce) {
    toast('Nuova partita iniziata.');
    speak('Nuova partita. In bocca al lupo!');
  }

  if (game.turn() !== settings.color) {
    const gen = generation;
    window.setTimeout(() => { if (!gameOver && gen === generation) askBot(); }, 600);
  }
}

function playPlayerMove(move) {
  if (!canInteract()) return;

  const played = game.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion || undefined,
  });
  if (!played) {
    toast('Mossa non legale.', 'error');
    return;
  }

  if (played.promotion) toast(`Promozione automatica a ${played.promotion === 'q' ? 'regina' : played.promotion.toUpperCase()}.`);
  uciMoves.push(toUci(played));
  lastMove = { from: played.from, to: played.to };
  selected = null;
  targets = [];

  el.heardText.textContent = `Hai giocato: ${played.san}`;
  if (settings.speakUserMove) speak(`Hai giocato ${moveToSpeech(played.san)}`);

  render();
  if (game.isGameOver()) return endGame();
  askBot();
}

async function askBot() {
  if (gameOver) return;
  const gen = ++generation;
  thinking = true;
  selected = null;
  targets = [];
  render();

  let moveUci = null;
  try {
    if (engine && !engine.failed && engine.ready) {
      await engine.setElo(settings.elo);
      if (gen !== generation) return;
      const thinkTime = Math.round(350 + settings.elo * 0.55);
      moveUci = await engine.bestMove({ moves: uciMoves, movetime: thinkTime });
    }
  } catch (error) {
    console.error('Errore del motore:', error);
  }

  if (gen !== generation) return;
  thinking = false;

  let played = null;
  if (moveUci && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(moveUci)) {
    try {
      played = game.move({
        from: moveUci.slice(0, 2),
        to: moveUci.slice(2, 4),
        promotion: moveUci[4] || 'q',
      });
    } catch { /* mossa non valida: fallback */ }
  }

  if (!played) {
    const legal = game.moves({ verbose: true });
    if (!legal.length) {
      render();
      return endGame();
    }
    played = game.move(legal[Math.floor(Math.random() * legal.length)]);
  }

  uciMoves.push(toUci(played));
  lastMove = { from: played.from, to: played.to };
  botSan = played.san;
  botPhrase = moveToSpeech(played.san);
  el.heardText.textContent = `Il bot ha giocato: ${played.san}`;
  speak(`Il bot gioca ${botPhrase}`);

  render();
  if (game.isGameOver()) endGame();
}

function handleMoveInput(text) {
  const cleaned = String(text || '').trim();
  if (!cleaned) return;
  el.heardText.textContent = `Hai detto: «${cleaned}»`;

  if (settings.voiceLang === 'auto' && looksEnglish(cleaned)) {
    voice.setLang('en-US');
  }

  if (gameOver) {
    toast('La partita è finita. Premi "Nuova partita".', 'error');
    return;
  }
  if (thinking || hintBusy) {
    toast('Attendi che il bot finisca di pensare.', 'error');
    return;
  }
  if (game.turn() !== settings.color) return;

  const result = parseMove(cleaned, game);
  if (result.reason === 'ambiguous') {
    const message = `Mossa ambigua: ${result.candidates.join(' oppure ')}. Indica la casella di partenza.`;
    toast(message, 'error');
    speak('Mossa ambigua. Indica la casella di partenza.');
    return;
  }
  if (!result.move) {
    toast('Non ho capito la mossa. Esempi: "e2 e4", "cavallo f3".', 'error');
    speak('Non ho capito la mossa. Riprova.');
    return;
  }

  playPlayerMove(result.move);
}

function onSquareClick(square) {
  if (!canInteract() || !settings.showBoard) return;

  const piece = game.get(square);

  if (selected) {
    const from = selected;
    if (square === from) {
      selected = null;
      targets = [];
      render();
      return;
    }

    const parsed = parseMove(`${from} ${square}`, game);
    if (parsed.move) {
      playPlayerMove(parsed.move);
      return;
    }

    const candidate = game.moves({ verbose: true }).find((m) => m.from === from && m.to === square);
    if (candidate) {
      if (candidate.promotion) toast(`Promozione automatica a ${candidate.promotion === 'q' ? 'regina' : candidate.promotion.toUpperCase()}.`);
      playPlayerMove(candidate);
      return;
    }
  }

  if (piece && piece.color === settings.color) {
    selected = square;
    targets = game.moves({ square, verbose: true });
    render();
  } else {
    selected = null;
    targets = [];
    render();
    if (piece) toast('Non è un tuo pezzo.');
  }
}

function endGame(reason, losingSide) {
  if (gameOver) return;
  gameOver = true;
  thinking = false;
  hintBusy = false;
  generation += 1;
  engine?.stop();
  selected = null;
  targets = [];

  let winner;
  let draw = false;

  if (reason === 'timeout') {
    winner = losingSide === 'w' ? 'b' : 'w';
  } else if (game.isCheckmate()) {
    winner = game.turn() === 'w' ? 'b' : 'w';
  } else {
    draw = true;
  }

  const playerWon = !draw && winner === settings.color;
  let message;
  if (draw) {
    message = game.isStalemate() ? 'Stallo: pareggio.' : 'Pareggio.';
    stats.draws += 1;
  } else if (playerWon) {
    message = reason === 'timeout' ? 'Tempo scaduto al bot: hai vinto!' : 'Scacco matto! Hai vinto.';
    stats.wins += 1;
  } else {
    message = reason === 'timeout' ? 'Tempo scaduto: hai perso.' : 'Scacco matto. Ha vinto il bot.';
    stats.losses += 1;
  }
  stats.games += 1;
  saveStats(stats);

  gameOverMessage = message;
  render();
  toast(message, draw ? '' : playerWon ? 'ok' : 'error');
  speak(message);
}

function undo() {
  if (!game.history().length) {
    toast('Nessuna mossa da annullare.');
    return;
  }

  const wasThinking = thinking;
  generation += 1;
  engine?.stop();
  thinking = false;
  hintBusy = false;
  gameOver = false;
  gameOverMessage = '';

  const steps = wasThinking ? 1 : 2;
  for (let i = 0; i < steps && game.history().length; i += 1) game.undo();

  const verbose = game.history({ verbose: true });
  uciMoves = verbose.map(toUci);
  const last = verbose[verbose.length - 1];
  lastMove = last ? { from: last.from, to: last.to } : null;
  botSan = '';
  botPhrase = '';
  selected = null;
  targets = [];
  lastTick = Date.now();

  render();
  toast('Mossa annullata.');
  if (game.turn() !== settings.color && !game.isGameOver()) askBot();
}

async function hint() {
  if (!canInteract()) return;
  const gen = generation;
  hintBusy = true;
  render();
  toast('Cerco la mossa migliore…');

  let moveUci = null;
  try {
    await engine.setFullStrength();
    moveUci = await engine.bestMove({ moves: uciMoves, movetime: 900 });
    await engine.setElo(settings.elo);
  } catch (error) {
    console.error('Suggerimento non disponibile:', error);
  }

  if (gen !== generation) return;
  hintBusy = false;

  if (!moveUci) {
    toast('Suggerimento non disponibile in questo momento.', 'error');
    render();
    return;
  }

  const match = game.moves({ verbose: true }).find((m) => toUci(m) === moveUci);
  if (!match) {
    toast('Suggerimento non valido.', 'error');
    render();
    return;
  }

  const phrase = moveToSpeech(match.san);
  el.heardText.textContent = `Suggerimento: ${match.san}`;
  toast(`Suggerimento: ${match.san} — ${phrase}`, 'ok');
  speak(`Suggerimento: ${phrase}`);
  render();
}

function downloadPgn() {
  const history = game.history();
  const result = game.isCheckmate()
    ? (game.turn() === 'w' ? '0-1' : '1-0')
    : game.isDraw() ? '1/2-1/2' : '*';

  const white = settings.color === 'w' ? 'Giocatore' : `Bot (${settings.elo} ELO)`;
  const black = settings.color === 'b' ? 'Giocatore' : `Bot (${settings.elo} ELO)`;
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '.');

  const rows = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push(`${i / 2 + 1}. ${history[i]}${history[i + 1] ? ` ${history[i + 1]}` : ''}`);
  }

  const pgn = [
    '[Event "Allenamento scacchi bendato"]',
    '[Site "Scacchi Bendato"]',
    `[Date "${date}"]`,
    '[Round "?"]',
    `[White "${white}"]`,
    `[Black "${black}"]`,
    `[Result "${result}"]`,
    '',
    rows.join(' '),
    '',
  ].join('\n');

  const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `scacchi-bendato-${date.replace(/\./g, '-')}.pgn`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('PGN scaricato.');
}

/* ------------------------------ Motore / voce ------------------------------ */

function onEngineStatus(status) {
  if (status === 'ready') {
    el.engineStatus.className = 'badge badge--ready';
    el.engineStatus.textContent = 'Stockfish pronto';
  } else if (status === 'loading') {
    el.engineStatus.className = 'badge badge--loading';
    el.engineStatus.textContent = 'Caricamento motore…';
  } else if (status === 'error') {
    el.engineStatus.className = 'badge badge--error';
    el.engineStatus.textContent = 'Bot casuale (motore non disponibile)';
    toast('Motore non caricato: il bot giocherà a caso.', 'error');
  }
}

/* ------------------------------ Impostazioni UI ------------------------------ */

function applySettingsToUI() {
  document.documentElement.setAttribute('data-theme', settings.theme);
  el.themeBtn.textContent = settings.theme === 'dark' ? '☀️' : '🌙';

  el.eloRange.value = String(settings.elo);
  el.eloValue.textContent = String(settings.elo);
  el.colorSelect.value = settings.color;
  el.clockSelect.value = String(settings.clock);
  el.voiceLangSelect.value = settings.voiceLang;
  el.continuousChk.checked = !!settings.continuous;
  el.confirmChk.checked = !!settings.speakUserMove;
}

/* ------------------------------ Inizializzazione ------------------------------ */

function init() {
  board = new BoardView(el.board, onSquareClick);
  voice = new Voice();
  voice.setLang(recognitionLang());

  voice.onTranscript = (text) => handleMoveInput(text);
  voice.onError = (error) => {
    if (error === 'not-allowed' || error === 'service-not-allowed') {
      toast('Consenti l’accesso al microfono nelle impostazioni del browser.', 'error');
    } else if (error === 'no-speech') {
      toast('Non ho sentito nulla. Riprova a parlare.', 'error');
    } else if (error === 'unsupported') {
      toast('Riconoscimento vocale non supportato: usa Chrome o Edge oppure scrivi la mossa.', 'error');
    } else if (error === 'already-started') {
      // Il microfono è già attivo: nessuna azione.
    } else {
      toast(`Microfono: ${error}`, 'error');
    }
  };
  voice.onState = (listening) => {
    el.micBtn.classList.toggle('is-listening', listening);
    el.micBtn.textContent = listening ? '🎙️ Ascolto… (clicca per fermare)' : '🎤 Parla la mossa';
  };

  engine = new Engine(onEngineStatus);
  engine.ready.catch(() => onEngineStatus('error'));

  applySettingsToUI();
  newGame({ announce: false });

  el.newGameBtn.addEventListener('click', () => newGame());
  el.eloRange.addEventListener('input', () => {
    settings.elo = Number(el.eloRange.value);
    el.eloValue.textContent = String(settings.elo);
    saveSettings(settings);
    engine.setElo(settings.elo).catch(() => {});
  });
  el.colorSelect.addEventListener('change', () => {
    settings.color = el.colorSelect.value;
    saveSettings(settings);
    newGame();
  });
  el.clockSelect.addEventListener('change', () => {
    settings.clock = Number(el.clockSelect.value);
    saveSettings(settings);
    newGame({ announce: false });
    toast('Tempo aggiornato: nuova partita iniziata.');
  });
  el.voiceLangSelect.addEventListener('change', () => {
    settings.voiceLang = el.voiceLangSelect.value;
    voice.setLang(recognitionLang());
    saveSettings(settings);
  });

  el.themeBtn.addEventListener('click', () => {
    settings.theme = settings.theme === 'dark' ? 'light' : 'dark';
    saveSettings(settings);
    applySettingsToUI();
  });

  el.boardToggle.addEventListener('click', () => {
    settings.showBoard = !settings.showBoard;
    saveSettings(settings);
    render();
  });
  el.piecesToggle.addEventListener('click', () => {
    settings.showPieces = !settings.showPieces;
    if (settings.showPieces) settings.showBoard = true;
    saveSettings(settings);
    render();
  });

  el.micBtn.addEventListener('click', () => voice.toggle());
  el.continuousChk.addEventListener('change', () => {
    settings.continuous = el.continuousChk.checked;
    saveSettings(settings);
    if (settings.continuous && canInteract()) voice.start(true);
    else voice.stop();
  });
  el.confirmChk.addEventListener('change', () => {
    settings.speakUserMove = el.confirmChk.checked;
    saveSettings(settings);
  });

  el.moveForm.addEventListener('submit', (event) => {
    event.preventDefault();
    handleMoveInput(el.moveInput.value);
    el.moveInput.value = '';
  });

  el.repeatBtn.addEventListener('click', () => {
    if (botPhrase) speak(`Il bot gioca ${botPhrase}`);
  });
  el.undoBtn.addEventListener('click', undo);
  el.hintBtn.addEventListener('click', hint);
  el.pgnBtn.addEventListener('click', downloadPgn);
  el.resetStatsBtn.addEventListener('click', () => {
    stats = { games: 0, wins: 0, draws: 0, losses: 0 };
    saveStats(stats);
    renderStats();
    toast('Statistiche azzerate.');
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      if (event.key === 'Enter' && target === el.moveInput) {
        event.preventDefault();
        el.moveForm.requestSubmit();
      }
      return;
    }

    const key = event.key.toLowerCase();
    if (key === 'm') { event.preventDefault(); voice.toggle(); }
    else if (key === 'u') { event.preventDefault(); undo(); }
    else if (key === 'h') { event.preventDefault(); hint(); }
    else if (key === 'b') { event.preventDefault(); el.boardToggle.click(); }
    else if (key === 'p') { event.preventDefault(); el.piecesToggle.click(); }
    else if (key === 'n') { event.preventDefault(); newGame(); }
    else if (key === 'escape') { selected = null; targets = []; render(); }
  });

  window.setInterval(clockTick, 250);
}

function clockTick() {
  const now = Date.now();
  const delta = (now - lastTick) / 1000;
  lastTick = now;

  if (gameOver || game.history().length === 0) return;
  const side = game.turn();

  if (timeLimit() > 0) {
    clocks[side] = Math.max(0, clocks[side] - delta);
    if (clocks[side] <= 0) {
      endGame('timeout', side);
      return;
    }
  } else {
    elapsed[side] += delta;
  }
  renderClocks();
}

init();
