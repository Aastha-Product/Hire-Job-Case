import { extractText, getDocumentProxy } from "unpdf";
import { ACCEPTED_LABEL, extensionOf } from "./formats";
import { docToText, pptToText, pptxToText } from "./office";

export { ACCEPTED_EXTENSIONS } from "./formats";

async function pdfToText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  return (await extractText(pdf, { mergePages: true })).text;
}

async function docxToText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  return (await mammoth.extractRawText({ buffer })).value;
}

// Files are often saved with the wrong extension, so trust the bytes over the name.
function sniff(buffer: Buffer): "pdf" | "zip" | "ole" | null {
  if (buffer.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buffer[0] === 0x50 && buffer[1] === 0x4b) return "zip"; // .docx / .pptx
  if (buffer.readUInt32BE(0) === 0xd0cf11e0) return "ole"; // .doc / .ppt
  return null;
}

async function extract(buffer: Buffer, filename: string): Promise<string> {
  const ext = extensionOf(filename);
  const kind = buffer.length >= 8 ? sniff(buffer) : null;
  if (kind === "pdf") return pdfToText(buffer);
  if (kind === "zip") {
    if (ext === ".pptx") return pptxToText(buffer);
    try {
      return await docxToText(buffer);
    } catch {
      return pptxToText(buffer);
    }
  }
  if (kind === "ole") {
    if (ext === ".doc") return docToText(buffer);
    try {
      return await pptToText(buffer);
    } catch {
      return docToText(buffer);
    }
  }
  if (ext === ".txt") return buffer.toString("utf8");
  throw new Error(`Can't read ${filename}. Upload a ${ACCEPTED_LABEL} file.`);
}

export async function cvToText(buffer: Buffer, filename: string): Promise<string> {
  let text: string;
  try {
    text = await extract(buffer, filename);
  } catch (e) {
    const msg = (e as Error).message;
    throw new Error(msg.startsWith("Can't read") || msg.startsWith("This ") ? msg : `Could not read ${filename}: ${msg}`);
  }
  text = text
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (text.length < 200) {
    throw new Error("Could not read enough text from this file. If it is a scanned image or a picture-only slide, save it as a text-based PDF.");
  }
  return text;
}
