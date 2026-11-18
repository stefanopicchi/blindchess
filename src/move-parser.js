// Riconosce una mossa dettata o digitata confrontandola con tutte le mosse legali.
// Accetta coordinate ("e2 e4"), nomi di pezzi in italiano/inglese, SAN, arrocco e promozioni.

const FILLERS = new Set([
  // italiano
  'muovi', 'muovo', 'sposta', 'sposto', 'gioca', 'gioco', 'fai', 'fatto', 'metti', 'porta',
  'prova', 'voglio', 'vorrei', 'dai', 'ok', 'okay', 'allora', 'adesso', 'per', 'favore',
  'grazie', 'questa', 'questo', 'la', 'il', 'lo', 'gli', 'le', 'un', 'una', 'da', 'a',
  'in', 'su', 'verso', 'e', 'con', 'mi', 'mossa', 'prossima', 'bene', 'si',
  // inglese
  'move', 'moves', 'play', 'do', 'the', 'an', 'my', 'next', 'please', 'to', 'from',
  'go', 'i', 'want', 'would', 'like', 'now', 'so', 'hey', 'yes', 'please',
]);

const PIECE_NAME = {
  it: { p: 'pedone', n: 'cavallo', b: 'alfiere', r: 'torre', q: 'regina', d: 'regina', k: 're' },
  en: { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' },
};

// Notazione algebrica standard (SAN, FIDE): N B R Q K, pedone senza lettera.
// Accettiamo anche gli equivalenti italiani (C A T D R), molto usati nelle
// scuole di scacchi. La forma compatta "<lettera><casella>" resta generale:
// Nf3, Cf3, Ac4, Td1, Dh5, Re1, e4, ecc.
const PIECE_LETTERS = {
  p: ['p'],
  n: ['n', 'c'], // knight / cavallo
  b: ['b', 'a'], // bishop / alfiere
  r: ['r', 't'], // rook / torre
  q: ['q', 'd'], // queen / donna
  k: ['k', 'r'], // king / re
};

const CAPTURE_WORDS = ['', 'x', 'prende', 'mangia', 'cattura', 'takes', 'capture'];

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !FILLERS.has(token))
    .join('');
}

function italianizeSan(san) {
  return String(san).replace(/^([KQRBN])/, (_, letter) => ({
    N: 'C', B: 'A', Q: 'D', K: 'R', R: 'T',
  }[letter]));
}

function castlingAliases(flag) {
  if (flag === 'k') {
    return ['oo', '00', 'arroccacorto', 'arroccacorta', 'arrocacorto', 'arroccore',
      'castleshort', 'shortcastle', 'castlekingside', 'kingsidecastle', 'castle', 'arrocca'];
  }
  return ['ooo', '000', 'arroccolungo', 'arroccolunga', 'arroccadonna', 'arrocalungo',
    'castlelong', 'longcastle', 'castlequeenside', 'queensidecastle', 'arrocca'];
}

/** Alias testuali accettati per una singola mossa legale. */
export function aliasesForMove(m) {
  const aliases = new Set();
  const add = (...values) => values.forEach((v) => { if (v) aliases.add(normalize(v)); });

  const promo = m.promotion ? m.promotion.toLowerCase() : '';
  const pieces = new Set([
    ...(PIECE_LETTERS[m.piece] || []),
    PIECE_NAME.it[m.piece],
    PIECE_NAME.en[m.piece],
  ].filter(Boolean));

  // Coordinate
  add(m.from + m.to + promo);
  if (m.piece === 'p') add(m.to + promo);

  // Notazione algebrica (standard e italiana)
  const sans = [m.san, m.san.replace(/[+#]/g, ''), italianizeSan(m.san), italianizeSan(m.san).replace(/[+#]/g, '')];
  add(...sans);

  // Nome del pezzo + (eventuale origine) + (eventuale cattura) + destinazione
  const origins = ['', m.from, m.from[0], m.from[1]];
  const captureWords = m.captured ? CAPTURE_WORDS : [''];
  for (const piece of pieces) {
    for (const origin of origins) {
      for (const capture of captureWords) {
        add(piece + origin + capture + m.to + promo);
        add(piece + origin + capture + m.to);
      }
    }
  }

  // Promozioni pronunciate
  if (promo) {
    const promoWords = [];
    if (promo === 'q') promoWords.push('regina', 'donna', 'queen', 'q', 'd');
    if (promo === 'r') promoWords.push('torre', 'rook', 'r');
    if (promo === 'b') promoWords.push('alfiere', 'bishop', 'b');
    if (promo === 'n') promoWords.push('cavallo', 'knight', 'n', 'c');
    for (const word of promoWords) {
      add(m.to + word);
      add('promuovi' + word + m.to);
      add('promote' + word + m.to);
      for (const piece of pieces) add(piece + m.to + word);
    }
  }

  // Arrocco
  if (m.flags && (m.flags.includes('k') || m.flags.includes('q'))) {
    add(...castlingAliases(m.flags.includes('k') ? 'k' : 'q'));
  }

  aliases.delete('');
  return aliases;
}

/**
 * @returns {{move: object|null, reason?: 'empty'|'unknown'|'ambiguous', candidates?: string[]}}
 */
export function parseMove(text, game) {
  const query = normalize(text);
  if (!query) return { move: null, reason: 'empty' };

  const legal = typeof game.moves === 'function' ? game.moves({ verbose: true }) : [];
  const matches = legal.filter((move) => aliasesForMove(move).has(query));

  if (matches.length === 1) return { move: matches[0] };
  if (matches.length > 1) {
    return { move: null, reason: 'ambiguous', candidates: matches.map((m) => m.san) };
  }
  return { move: null, reason: 'unknown' };
}

/** True se il testo sembra inglese: serve per passare la lingua del microfono. */
export function looksEnglish(text) {
  return /\b(knight|bishop|rook|queen|king|pawn|castle|takes|move|play|promote|short|long)\b/i.test(String(text));
}
