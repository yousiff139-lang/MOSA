// MOSA Smart Voice & Sound FX Engine (Bulletproof Web Audio & Speech Synthesis)

// Global reference to prevent V8 garbage collection of active utterances
if (typeof window !== 'undefined') {
  (window as any).__mosaUtterances = (window as any).__mosaUtterances || [];
}

// 1. Futuristic Smart Home Sound Effects via Web Audio API (Zero external assets needed)
class SoundFX {
  private ctx: AudioContext | null = null;

  private initCtx() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Success Harmonic Chime (Task Complete Confirmation)
  playSuccessChime() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      const now = ctx.currentTime;
      
      // Tone 1 (E5 - 659.25Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2 (B5 - 987.77Hz - High chord harmonic)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.08);
      gain2.gain.setValueAtTime(0.18, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.55);
    } catch (e) {
      // Ignore audio context errors silently
    }
  }

  // Listening Start Chime
  playListeningChime() {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
    } catch (e) {}
  }
}

export const mosaSound = new SoundFX();

export interface VoiceSettings {
  assistantName: string;
  engine: 'roro' | 'alexa' | 'siri' | 'google' | 'custom';
  pitch: number;      // 0.5 to 2.0 (Default 1.15 for warm feminine/natural tone)
  rate: number;       // 0.5 to 1.5 (Default 1.05)
  volume: number;     // 0.0 to 1.0 (Default 1.0)
  voiceURI?: string;
  toneStyle: 'warm_friendly' | 'sharp_assistant' | 'calm_eco';
}

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  assistantName: 'Roro',
  engine: 'roro',
  pitch: 1.15,
  rate: 1.05,
  volume: 1.0,
  toneStyle: 'warm_friendly'
};

export function getStoredVoiceSettings(): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS;
  try {
    const saved = localStorage.getItem('mosa_voice_settings');
    if (saved) {
      return { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) };
    }
  } catch {}
  return DEFAULT_VOICE_SETTINGS;
}

export function saveVoiceSettings(settings: Partial<VoiceSettings>): VoiceSettings {
  if (typeof window === 'undefined') return DEFAULT_VOICE_SETTINGS;
  try {
    const current = getStoredVoiceSettings();
    const updated = { ...current, ...settings };
    localStorage.setItem('mosa_voice_settings', JSON.stringify(updated));
    return updated;
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

// 2. State-of-the-art Arabic Speech Synthesis Engine (Roro & Multi-Engine Voice)
export function speakMosaVoice(text: string, onEnd?: () => void, customSettings?: Partial<VoiceSettings>) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

  const activeSettings = { ...getStoredVoiceSettings(), ...customSettings };

  // Clean text from markdown, symbols or JSON tags
  const cleanText = text
    .replace(/\{.*\}/g, '')
    .replace(/[•\n\r]/g, ' ')
    .replace(/[#*_~`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanText) return;

  try {
    // 1. Cancel in-flight and resume synthesizer
    window.speechSynthesis.cancel();
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Play subtle success chime
    mosaSound.playSuccessChime();

    // 2. Delay slightly to prevent Chromium cancel() collision bug
    setTimeout(() => {
      try {
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'ar-SA';
        utterance.rate = activeSettings.rate;
        utterance.pitch = activeSettings.pitch;
        utterance.volume = activeSettings.volume;

        // Auto-select best voice matching preferences or Arabic
        const voices = window.speechSynthesis.getVoices();
        let selectedVoice: SpeechSynthesisVoice | undefined;

        if (activeSettings.voiceURI) {
          selectedVoice = voices.find(v => v.voiceURI === activeSettings.voiceURI);
        }

        if (!selectedVoice) {
          selectedVoice = voices.find(v => 
            v.lang.toLowerCase().startsWith('ar') || 
            v.name.toLowerCase().includes('arabic') ||
            v.name.toLowerCase().includes('laila') ||
            v.name.toLowerCase().includes('zeina') ||
            v.name.toLowerCase().includes('maged') ||
            v.name.toLowerCase().includes('tarik') ||
            v.name.toLowerCase().includes('naayf')
          );
        }

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        // Store reference to prevent V8 garbage collection
        (window as any).__mosaUtterances.push(utterance);

        utterance.onend = () => {
          const idx = (window as any).__mosaUtterances.indexOf(utterance);
          if (idx > -1) (window as any).__mosaUtterances.splice(idx, 1);
          if (onEnd) onEnd();
        };

        utterance.onerror = (e) => {
          console.warn('[Roro Voice] TTS error or interrupted:', e);
          const idx = (window as any).__mosaUtterances.indexOf(utterance);
          if (idx > -1) (window as any).__mosaUtterances.splice(idx, 1);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('[Roro Voice] Speech synthesis execution failed:', err);
      }
    }, 60);

  } catch (err) {
    console.error('[Roro Voice] Failed to invoke speech synthesis:', err);
  }
}
