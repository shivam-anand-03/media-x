import crypto from "crypto";

const algorithm = "aes-256-cbc";
const key = Buffer.from(process.env.ENCRYPTION_KEY!, "base64");

export function encrypt(text: string) {
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final(),
  ]);

  return {
    iv: iv.toString("base64"),
    encryptedData: encrypted.toString("base64"),
  };
}

export function decrypt(payload: { iv: string; encryptedData: string }) {
  const iv = Buffer.from(payload.iv, "base64");
  const encryptedText = Buffer.from(payload.encryptedData, "base64");

  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedText),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
