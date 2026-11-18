// Preferenze e statistiche salvate nel browser (localStorage).

const SETTINGS_KEY = 'blindchess:settings:v1';
const STATS_KEY = 'blindchess:stats:v1';

export const DEFAULT_SETTINGS = {
  elo: 800,
  color: 'w',
  clock: 0,
  voiceLang: 'auto',
  showBoard: false,
  showPieces: false,
  speakUserMove: true,
  continuous: false,
  theme: 'light',
};

export const DEFAULT_STATS = { games: 0, wins: 0, draws: 0, losses: 0 };

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return { ...fallback };
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Modalità privata / spazio esaurito: l'app continua a funzionare in memoria.
  }
}

export const loadSettings = () => read(SETTINGS_KEY, DEFAULT_SETTINGS);
export const saveSettings = (settings) => write(SETTINGS_KEY, settings);

export const loadStats = () => read(STATS_KEY, DEFAULT_STATS);
export const saveStats = (stats) => write(STATS_KEY, stats);
