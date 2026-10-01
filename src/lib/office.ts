// Text extraction for PowerPoint (.ppt, .pptx) and legacy Word (.doc) CVs.

// Placeholder text PowerPoint stores on slide masters; never part of a CV.
const MASTER_TEXT = /^(click to edit master|click to add|second level|third level|fourth level|fifth level|‹#›|\*)$/i;

function cleanLines(parts: string[]): string {
  return parts
    .flatMap((p) => p.split(/[\r\n\u000b]+/))
    .map((l) => l.replace(/[\u0000-\u0008\u000c\u000e-\u001f]/g, "").trim())
    .filter((l) => l && !MASTER_TEXT.test(l) && !/^click to edit master/i.test(l))
    .filter((l, i, all) => all.indexOf(l) === i || l.length > 40) // drop repeated short master/footer lines
    .join("\n");
}

/**
 * PowerPoint 97-2003: walk the record tree in the "PowerPoint Document" stream
 * and collect TextCharsAtom (UTF-16) and TextBytesAtom (Latin-1) records.
 */
export async function pptToText(buffer: Buffer): Promise<string> {
  const CFB = (await import("cfb")).default ?? (await import("cfb"));
  const container = CFB.read(buffer, { type: "buffer" });
  const entry = CFB.find(container, "PowerPoint Document");
  if (!entry?.content) throw new Error("This .ppt file has no slide text (is it a real PowerPoint file?).");
  const stream = Buffer.from(entry.content as Uint8Array);

  const parts: string[] = [];
  let pos = 0;
  while (pos + 8 <= stream.length) {
    const verInst = stream.readUInt16LE(pos);
    const type = stream.readUInt16LE(pos + 2);
    const len = stream.readUInt32LE(pos + 4);
    const body = pos + 8;
    if ((verInst & 0x0f) === 0x0f) {
      pos = body; // container: step inside
      continue;
    }
    if (body + len > stream.length) break;
    if (type === 0x0fa0) parts.push(stream.toString("utf16le", body, body + len)); // TextCharsAtom
    else if (type === 0x0fa8) parts.push(stream.toString("latin1", body, body + len)); // TextBytesAtom
    pos = body + len;
  }
  return cleanLines(parts);
}

/** PowerPoint 2007+: slide XML inside the zip, in slide order. */
export async function pptxToText(buffer: Buffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buffer);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  if (!slides.length) throw new Error("This .pptx file has no slides.");
  const parts: string[] = [];
  for (const name of slides) {
    const xml = await zip.files[name].async("string");
    for (const para of xml.split(/<\/a:p>/)) {
      const text = [...para.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join("");
      if (text) parts.push(decodeXml(text));
    }
  }
  return cleanLines(parts);
}

/** Word 97-2003 .doc. */
export async function docToText(buffer: Buffer): Promise<string> {
  const WordExtractor = (await import("word-extractor")).default;
  const doc = await new WordExtractor().extract(buffer);
  return [doc.getHeaders?.({ includeFooters: false }) ?? "", doc.getBody()].join("\n");
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}
