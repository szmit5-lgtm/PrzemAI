// Pure helpers for browser speech recognition, especially on mobile.
export function combineVoiceText(prefix,transcript) {
  return [prefix,transcript].filter(x=>typeof x==="string"&&x.trim())
    .map(x=>x.trim()).join(" ").trim();
}
export function shouldSubmitVoiceTurn(turn) {
  return Boolean(turn && turn.autoSend && !turn.cancelled && !turn.error &&
    typeof turn.transcript==="string" && turn.transcript.trim());
}
