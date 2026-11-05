/** Menu words only (gameplay is text-free). Max ~18 characters. */
export type Lang = 'en' | 'de' | 'fr' | 'es' | 'pt' | 'tr' | 'ru' | 'ja';
const L: readonly Lang[] = ['en', 'de', 'fr', 'es', 'pt', 'tr', 'ru', 'ja'];
type E = Record<Lang, string>;
const D = {
  title: { en: 'Toy Fort', de: 'Spielzeugburg', fr: 'Fort des Jouets', es: 'Fuerte de Juguete', pt: 'Forte de Brinquedo', tr: 'Oyuncak Kalesi', ru: 'Крепость игрушек', ja: 'おもちゃの砦' },
  play: { en: 'Play', de: 'Spielen', fr: 'Jouer', es: 'Jugar', pt: 'Jogar', tr: 'Oyna', ru: 'Играть', ja: 'あそぶ' },
  bedroom: { en: 'Bedroom', de: 'Kinderzimmer', fr: 'Chambre', es: 'Dormitorio', pt: 'Quarto', tr: 'Yatak Odası', ru: 'Спальня', ja: 'こども部屋' },
  desk: { en: 'Study Desk', de: 'Schreibtisch', fr: 'Bureau', es: 'Escritorio', pt: 'Escrivaninha', tr: 'Çalışma Masası', ru: 'Письм. стол', ja: 'つくえ' },
  sandbox: { en: 'Sandbox', de: 'Sandkasten', fr: 'Bac à sable', es: 'Arenero', pt: 'Caixa de Areia', tr: 'Kum Havuzu', ru: 'Песочница', ja: 'すなば' },
  album: { en: 'Sticker Album', de: 'Stickeralbum', fr: 'Album', es: 'Álbum', pt: 'Álbum', tr: 'Çıkartma Albümü', ru: 'Альбом', ja: 'シール帳' },
  paused: { en: 'Paused', de: 'Pause', fr: 'Pause', es: 'Pausa', pt: 'Pausa', tr: 'Durdu', ru: 'Пауза', ja: 'ポーズ' },
  settings: { en: 'Settings', de: 'Optionen', fr: 'Réglages', es: 'Ajustes', pt: 'Opções', tr: 'Ayarlar', ru: 'Настройки', ja: '設定' },
  sound: { en: 'Sound', de: 'Ton', fr: 'Son', es: 'Sonido', pt: 'Som', tr: 'Ses', ru: 'Звук', ja: 'サウンド' },
  endless: { en: 'Endless', de: 'Endlos', fr: 'Sans fin', es: 'Sin fin', pt: 'Infinito', tr: 'Sonsuz', ru: 'Бесконечно', ja: 'エンドレス' },
  level: { en: 'Level', de: 'Level', fr: 'Niveau', es: 'Nivel', pt: 'Nível', tr: 'Bölüm', ru: 'Уровень', ja: 'レベル' },
  rotate: { en: 'Turn your device', de: 'Gerät drehen', fr: 'Tournez l\'écran', es: 'Gira el móvil', pt: 'Gire o aparelho', tr: 'Cihazı çevir', ru: 'Поверните экран', ja: '横向きにしてね' },
} satisfies Record<string, E>;
export type Key = keyof typeof D;
let cur: Lang = 'en';
export function setLang(code: string) { const c = (code || 'en').slice(0, 2).toLowerCase() as Lang; cur = L.includes(c) ? c : 'en'; }
export const t = (k: Key) => D[k][cur] ?? D[k].en;
