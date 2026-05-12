import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

export function deriveEncryptionKey(secret = process.env.INTELLIGENCE_ENCRYPTION_KEY) {
  if (!secret || secret.length < 16) {
    throw new Error("INTELLIGENCE_ENCRYPTION_KEY must be set to at least 16 characters before storing provider keys");
  }
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plaintext, secret) {
  if (!plaintext) {
    throw new Error("Cannot encrypt an empty secret");
  }
  const key = deriveEncryptionKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(encrypted, secret) {
  if (!encrypted?.startsWith("enc:v1:")) {
    throw new Error("Secret is not encrypted with the ClusterFi v1 envelope");
  }
  const [, , ivB64, tagB64, cipherB64] = encrypted.split(":");
  const key = deriveEncryptionKey(secret);
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(cipherB64, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}

export function maskSecret(secret) {
  if (!secret) return null;
  const visible = String(secret).slice(-4);
  return `****${visible}`;
}
