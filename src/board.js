// Rendering della scacchiera. Con "showPieces = false" mostra solo le caselle vuote.

const FILES = 'abcdefgh';
const GLYPHS = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};
const NAMES_IT = { p: 'pedone', n: 'cavallo', b: 'alfiere', r: 'torre', q: 'regina', k: 're' };

export class BoardView {
  constructor(element, onSquareClick) {
    this.el = element;
    this.onSquareClick = onSquareClick;
    this.squares = [];

    for (let i = 0; i < 64; i += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'square';
      button.dataset.index = String(i);
      button.addEventListener('click', () => {
        if (button.dataset.square) this.onSquareClick?.(button.dataset.square);
      });
      this.el.appendChild(button);
      this.squares.push(button);
    }
  }

  render({
    game,
    orientation = 'w',
    showPieces = false,
    selected = null,
    targets = [],
    lastMove = null,
    interactive = true,
  }) {
    const ranks = orientation === 'w' ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
    const files = orientation === 'w' ? [...FILES] : [...FILES].reverse();
    const targetSet = new Set(targets.map((t) => t.square || t));

    let index = 0;
    for (const rank of ranks) {
      for (const file of files) {
        const square = file + rank;
        const button = this.squares[index];
        index += 1;

        const isLight = (FILES.indexOf(file) + rank) % 2 === 0;
        const piece = showPieces ? game.get(square) : null;
        const isTarget = targetSet.has(square);
        const isCapture = targets.some((t) => (t.square || t) === square && t.captured);

        const classes = ['square', isLight ? 'square--light' : 'square--dark'];
        if (piece) classes.push(piece.color === 'w' ? 'square--white-piece' : 'square--black-piece');
        if (lastMove && (square === lastMove.from || square === lastMove.to)) classes.push('square--last');
        if (square === selected) classes.push('square--selected');
        if (isTarget) classes.push('square--target');
        if (isCapture) classes.push('square--capture');

        button.className = classes.join(' ');
        button.dataset.square = square;
        button.disabled = !interactive;

        const fileLabel = file === files[files.length - 1]
          ? `<span class="coord coord--file">${file}</span>` : '';
        const rankLabel = rank === ranks[ranks.length - 1]
          ? `<span class="coord coord--rank">${rank}</span>` : '';
        const glyph = piece ? GLYPHS[piece.color][piece.type] : '';

        button.innerHTML = `${glyph}${fileLabel}${rankLabel}`;
        const pieceLabel = piece
          ? `, ${piece.color === 'w' ? 'bianco' : 'nero'} ${NAMES_IT[piece.type]}`
          : '';
        button.setAttribute('aria-label', `Casella ${square}${pieceLabel}${isTarget ? ', destinazione possibile' : ''}`);
      }
    }
  }
}
