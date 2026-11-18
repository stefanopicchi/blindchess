# ♞ BlindChess

Un'app web per imparare a giocare a scacchi **senza guardare la scacchiera**. Giochi contro un bot (Stockfish 17.1 in WebAssembly) con livello ELO selezionabile, detti la tua mossa **a voce** oppure la scrivi / clicchi, e il bot ti risponde **per iscritto e a voce**.

La scacchiera parte **nascosta**: l'obiettivo è allenare la memoria e il calcolo mentale. Puoi mostrarla quando vuoi, e puoi anche mostrare i pezzi se sei un principiante.

## Funzionalità

- **Avversario**: Stockfish 17.1 WASM, ELO regolabile da 400 a 2000. Stockfish accetta `UCI_Elo` solo da 1320 in su: sotto quella soglia l'app usa `Skill Level` (0–10) per rendere il bot davvero più debole. Se il motore non si carica, si passa a un bot casuale.
- **Inserimento mosse**: microfono, clic sulla scacchiera e campo di testo.
- **Riconoscimento vocale bilingue**: italiano e inglese, con passaggio automatico da IT a EN se rilevi parole inglesi.
- **Mosse accettate** (parlate o scritte):
  - coordinate: `e2 e4`, `e2e4`
  - pezzi: `cavallo f3`, `knight f3`, `Cf3`, `Nf3`
  - con origine: `cavallo da g1 a f3`, `knight g1 f3`
  - catture: `cavallo prende f5`, `knight takes f5`, `Cxf5`
  - arrocco: `arrocca corto`, `arrocca lungo`, `castle short`, `O-O`, `O-O-O`
  - promozione: `e7 e8 regina`, `promote queen`
  - se una mossa è ambigua, l'app ti chiede di indicare la casella di partenza.
- **Bot a voce**: la mossa del bot viene mostrata e pronunciata in italiano, ad es. *«Il bot gioca Cavallo prende f3, scacco.»*
- **Scacchiera**: nascosta di default; pulsanti separati per mostrare la scacchiera e per mostrare i pezzi.
- **Extra**: annulla mossa, suggerimento (motore a forza piena), storico, cronometro (anche con tempo limite), conferma vocale della tua mossa, download PGN, tema scuro, statistiche salvate nel browser.
- **Scorciatoie**: `M` microfono · `U` annulla · `H` suggerimento · `B` scacchiera · `P` pezzi · `N` nuova partita · `Esc` deseleziona · `Invio` invia la mossa scritta.

## Struttura

```text
.
├── index.html                         # interfaccia
├── styles.css                         # tema chiaro/scuro e layout
├── app.js                             # logica di gioco e UI
├── src/
│   ├── board.js                       # rendering della scacchiera
│   ├── engine.js                      # wrapper UCI per Stockfish (Web Worker)
│   ├── move-parser.js                 # parsing bilingue delle mosse
│   ├── notation.js                    # SAN -> frase parlata
│   ├── speech.js                      # Web Speech API (riconoscimento + sintesi)
│   └── storage.js                     # impostazioni e statistiche (localStorage)
├── vendor/
│   ├── chess.js                       # chess.js 1.4.0 (BSD-3-Clause)
│   └── stockfish/                     # Stockfish 17.1 lite-single (GPLv3)
├── _headers                           # header per Cloudflare Pages
└── README.md
```

Nessun build step, nessuna dipendenza npm: è tutto JavaScript statico. Le librerie sono incluse in `vendor/` per funzionare anche senza CDN.

## Avvio in locale

Il microfono funziona solo su `localhost` o HTTPS. Apri un server statico nella cartella del progetto:

```bash
# Python
python -m http.server 8000
```

oppure, se hai Node.js:

```bash
npx serve .
```

Poi visita <http://localhost:8000>.

Consigli: usa **Chrome** o **Edge** per il riconoscimento vocale (Web Speech API). La prima volta il browser chiederà il permesso di usare il microfono.

## Pubblicazione su GitHub + Cloudflare Pages

1. Crea su GitHub una repository vuota, ad esempio `BlindChess` (senza aggiungere README o LICENSE, così non ci sono conflitti).
2. Questa cartella è **già un repository Git con i commit pronti**. Dalla cartella del progetto esegui:

   ```bash
   git remote add origin https://github.com/TUO-UTENTE/BlindChess.git
   git branch -M main
   git push -u origin main
   ```

3. Vai su [Cloudflare Dashboard](https://dash.cloudflare.com/) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
4. Seleziona la repository GitHub, branch `main`.
5. Build settings:
   - **Build command**: vuoto
   - **Build output directory**: `/` (root del progetto)
6. Deploy. Cloudflare Pages serve automaticamente anche il file `.wasm` con il MIME type corretto.

Funziona anche su GitHub Pages: imposta **Settings → Pages → Deploy from a branch → main / root**.

## Note

- Il motore è la build **lite single-thread** di Stockfish: ~7 MB, nessun header COOP/COEP richiesto.
- La promozione tramite clic sulla scacchiera sceglie automaticamente la regina; per scegliere un altro pezzo, detta o scrivi la mossa (es. `e7 e8 cavallo`).
- Le statistiche e le preferenze restano solo nel tuo browser (localStorage).

## Licenze

- Codice dell'app: MIT (puoi aggiungere un file `LICENSE` se vuoi).
- `vendor/chess.js`: chess.js, BSD-3-Clause.
- `vendor/stockfish/`: Stockfish.js 17.1 di nmrugg / Chess.com, GPLv3.
