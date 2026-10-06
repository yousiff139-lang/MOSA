// A lightweight utility for UI sounds using Web Audio API to avoid external assets.
let audioCtx: AudioContext | null = null;

export const playClickSound = (enabled: boolean = true) => {
  if (!enabled) return;
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine';
    // Frequency for a soft pop/click sound
    oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(300, audioCtx.currentTime + 0.05);
    
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.06);
  } catch (e) {
    console.error("Audio API not supported or blocked", e);
  }
};

export const playHapticFeedback = (enabled: boolean = true) => {
  if (!enabled) return;
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(40); // 40ms light vibration
    } catch (e) {
      // Ignore errors if vibration is not supported or blocked
    }
  }
};
