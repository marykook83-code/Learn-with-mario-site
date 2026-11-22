let activeButton = null;
let cleanup = null;
const settings = { rate: 0.95, help: false };

export function setSpeechSettings(values) {
  Object.assign(settings, values);
}

function pickVoice(lang) {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.lang.replace("_", "-") === lang)
    || voices.find(v => v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
}

function wrapWords(container) {
  const original = container.textContent;
  const words = [];
  container.textContent = "";
  let position = 0;
  original.split(/(\s+)/).forEach(part => {
    if (!part) return;
    if (/^\s+$/.test(part)) container.append(part);
    else {
      const span = document.createElement("span");
      span.textContent = part;
      container.append(span);
      words.push({ span, start: position, end: position + part.length });
    }
    position += part.length;
  });
  return { words, restore: () => { container.textContent = original; } };
}

export function stopSpeech() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  if (cleanup) cleanup();
  cleanup = null;
  if (activeButton) activeButton.classList.remove("playing");
  activeButton = null;
}

export function speak(text, button, lang = "ar-EG") {
  if (!("speechSynthesis" in window)) return false;
  const wasActive = button && button === activeButton;
  stopSpeech();
  if (wasActive) return true;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(lang);
  utterance.lang = voice ? voice.lang : lang;
  if (voice) utterance.voice = voice;
  utterance.pitch = 1.25;
  utterance.rate = settings.rate;
  const target = button && button.previousElementSibling;
  if (settings.help && target && target.textContent.trim() === text.trim()) {
    const { words, restore } = wrapWords(target);
    cleanup = restore;
    utterance.onboundary = (event) => {
      words.forEach(w => w.span.classList.remove("speaking-word"));
      const current = words.find(w => event.charIndex >= w.start && event.charIndex < w.end);
      if (current) current.span.classList.add("speaking-word");
    };
  }
  utterance.onend = utterance.onerror = () => {
    if (activeButton === button) stopSpeech();
  };
  activeButton = button;
  if (button) button.classList.add("playing");
  speechSynthesis.speak(utterance);
  return true;
}
