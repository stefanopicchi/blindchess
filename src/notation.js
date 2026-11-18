// Converte la notazione algebrica in una frase pronunciabile (italiano / inglese).

const NAMES = {
  it: { p: 'pedone', n: 'cavallo', b: 'alfiere', r: 'torre', q: 'regina', k: 're' },
  en: { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' },
};

/**
 * "Nxf3+" -> "Cavallo prende f3, scacco."
 * "O-O"   -> "Arroccato corto."
 */
export function moveToSpeech(san, lang = 'it') {
  const it = lang !== 'en';
  const names = it ? NAMES.it : NAMES.en;
  const raw = String(san || '').replace(/[!?]/g, '');

  const check = raw.includes('#')
    ? (it ? ', scacco matto' : ', checkmate')
    : raw.includes('+')
      ? (it ? ', scacco' : ', check')
      : '';

  const s = raw.replace(/[+#]/g, '');

  if (/^O-O-O|^0-0-0/.test(s)) return (it ? 'Arroccato lungo' : 'Castled queenside') + check + '.';
  if (/^O-O|^0-0/.test(s)) return (it ? 'Arroccato corto' : 'Castled kingside') + check + '.';

  const first = s[0];
  const isPiece = /[KQRBN]/.test(first);
  const piece = isPiece ? first.toLowerCase() : 'p';
  let rest = isPiece ? s.slice(1) : s;

  const capture = rest.includes('x');
  rest = rest.replace(/x/g, '');

  let promo = '';
  const promoMatch = rest.match(/=([QRBN])$/);
  if (promoMatch) {
    promo = promoMatch[1].toLowerCase();
    rest = rest.slice(0, -2);
  }

  const destMatch = rest.match(/([a-h][1-8])$/);
  const to = destMatch ? destMatch[1] : rest;
  const from = destMatch ? rest.slice(0, -2) : '';

  let phrase = names[piece] || names.p;
  if (from) phrase += it ? ` da ${from}` : ` from ${from}`;
  if (capture) phrase += it ? ' prende' : ' takes';
  phrase += ` ${to}`;
  if (promo) phrase += it ? ` e promuove a ${names[promo]}` : ` and promotes to ${names[promo]}`;

  return phrase.charAt(0).toUpperCase() + phrase.slice(1) + check + '.';
}

/** Etichetta breve per lo storico: "Cf3", "exd5", "O-O". */
export function compactSan(san) {
  return String(san || '').replace(/[!?]/g, '');
}
