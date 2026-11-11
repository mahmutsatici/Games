// Settings overlay: sound toggle + master volume slider, language selector, and reset confirmation.
import { LANGS, getLang, setLang, t, type Lang } from './i18n';
import type { GameState } from './state';
import { Overlays, button, el } from './overlay';
import { sound } from './audio';
import { SVG_SOUND_OFF, SVG_SOUND_ON } from './icons';

const LANG_NAMES: Record<Lang, string> = {
  en: 'EN',
  de: 'DE',
  fr: 'FR',
  es: 'ES',
  pt: 'PT',
  tr: 'TR',
  ru: 'RU',
  ja: 'JA',
};

export function showSettingsOverlay(
  overlays: Overlays,
  state: GameState,
  onReset: () => void,
  onClose: () => void,
): void {
  overlays.open((card, close) => {
    card.classList.add('settings-card');
    el('div', 'settings-title', t('settings'), card);

    // Sound mute + Master Volume slider row
    const soundSection = el('div', 'settings-section', '', card);
    el('div', 'settings-label', t('sound'), soundSection);

    const audioControls = el('div', 'audio-controls', '', soundSection);
    const volSlider = document.createElement('input');
    volSlider.type = 'range';
    volSlider.min = '0';
    volSlider.max = '100';
    volSlider.value = String(Math.round((state.volume ?? 0.8) * 100));
    volSlider.className = 'vol-slider';
    volSlider.addEventListener('input', () => {
      const v = Number(volSlider.value) / 100;
      state.volume = v;
      sound.setVolume(v);
      if (v > 0 && !state.sound) {
        state.sound = true;
        sound.setEnabled(true);
        updateSoundBtn();
      }
    });
    audioControls.appendChild(volSlider);

    const soundBtn = button(
      state.sound ? 'green small' : 'panel small',
      '',
      audioControls,
      () => {
        state.sound = !state.sound;
        sound.setEnabled(state.sound);
        updateSoundBtn();
      },
    );
    const updateSoundBtn = () => {
      soundBtn.className = 'btn ' + (state.sound ? 'green small' : 'panel small');
      soundBtn.innerHTML = state.sound ? SVG_SOUND_ON : SVG_SOUND_OFF;
    };
    updateSoundBtn();

    // Language section
    const langSection = el('div', 'settings-section column', '', card);
    el('div', 'settings-label', t('language'), langSection);
    const langGrid = el('div', 'lang-grid', '', langSection);

    const langButtons: HTMLButtonElement[] = [];

    LANGS.forEach((l) => {
      const active = getLang() === l;
      const b = el('button', `btn small lang-btn ${active ? 'active' : ''}`, LANG_NAMES[l], langGrid);
      b.type = 'button';
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        sound.playClick();
        setLang(l);
        state.lang = l;
        langButtons.forEach((btn, idx) => {
          btn.classList.toggle('active', LANGS[idx] === l);
        });
      });
      langButtons.push(b);
    });

    // Reset progress row with confirmation inside UI
    const resetSection = el('div', 'settings-section reset-wrap', '', card);
    let confirming = false;

    const renderResetUI = () => {
      resetSection.innerHTML = '';
      if (!confirming) {
        button('panel small danger-btn', t('reset'), resetSection, () => {
          confirming = true;
          renderResetUI();
        });
      } else {
        const confirmBox = el('div', 'confirm-box', '', resetSection);
        el('div', 'confirm-text', t('sure'), confirmBox);
        const btnRow = el('div', 'row', '', confirmBox);
        button('green small', t('yes'), btnRow, () => {
          onReset();
          close();
          onClose();
        });
        button('panel small', t('no'), btnRow, () => {
          confirming = false;
          renderResetUI();
        });
      }
    };
    renderResetUI();

    button('panel', t('back'), card, () => {
      close();
      onClose();
    });
  }, 'settings-dialog');
}
