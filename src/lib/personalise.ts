/** Substitute the real name at display/send time. The AI never sees it. */
export function personalise(text: string, name: string): string {
  const first = name.trim().split(/\s+/)[0] || "there";
  return text.replace(/\[NAME\]/g, first).replace(/\[CANDIDATE\]/g, name);
}
