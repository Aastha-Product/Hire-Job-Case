// CV file types the app can read. Shared by the upload page and the server.
export const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc", ".pptx", ".ppt", ".txt"];
export const ACCEPTED_LABEL = "PDF, Word (.docx/.doc), PowerPoint (.pptx/.ppt) or TXT";

export const extensionOf = (filename: string) => filename.toLowerCase().slice(filename.lastIndexOf("."));
export const isAccepted = (filename: string) => ACCEPTED_EXTENSIONS.includes(extensionOf(filename));
