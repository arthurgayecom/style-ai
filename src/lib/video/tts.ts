export function getVoices(): SpeechSynthesisVoice[] {
  return window.speechSynthesis.getVoices();
}

export function pickTwoVoices(voices: SpeechSynthesisVoice[]): [SpeechSynthesisVoice | null, SpeechSynthesisVoice | null] {
  const english = voices.filter(v => v.lang.startsWith('en'));
  const pool = english.length >= 2 ? english : voices;
  const male = pool.find(v => v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('james'));
  const female = pool.find(v => v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('zira') || v.name.toLowerCase().includes('samantha'));
  if (male && female) return [male, female];
  return [pool[0] || null, pool[1] || pool[0] || null];
}

export function speakText(
  text: string,
  voice: SpeechSynthesisVoice | null,
  rate: number,
  onWord: (wordIndex: number) => void,
  onEnd: () => void,
): SpeechSynthesisUtterance {
  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) utterance.voice = voice;
  utterance.rate = rate;
  utterance.pitch = 1;

  const words = text.split(/\s+/);
  let charPos = 0;

  utterance.onboundary = (event) => {
    if (event.name === 'word') {
      // Find which word we're at based on character position
      let accum = 0;
      for (let i = 0; i < words.length; i++) {
        if (accum >= event.charIndex) {
          onWord(i);
          break;
        }
        accum += words[i].length + 1;
      }
    }
  };

  utterance.onend = onEnd;

  window.speechSynthesis.speak(utterance);
  return utterance;
}

export function stopSpeaking() {
  window.speechSynthesis.cancel();
}
