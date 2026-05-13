import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { ethers } from "ethers";

const DEFAULT_NONCE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_SESSION_TTL_MS = 60 * 60 * 1000;

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlDecode(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function sign(value, secret) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
}

export function normalizeAddress(address) {
  return ethers.getAddress(address).toLowerCase();
}

export class WalletAuthService {
  constructor({
    secret = process.env.GATEWAY_AUTH_SECRET,
    nonceTtlMs = DEFAULT_NONCE_TTL_MS,
    sessionTtlMs = Number(process.env.GATEWAY_SESSION_TTL_MS || DEFAULT_SESSION_TTL_MS),
  } = {}) {
    this.secret = secret;
    this.nonceTtlMs = nonceTtlMs;
    this.sessionTtlMs = sessionTtlMs;
    this.nonces = new Map();
  }

  assertReady() {
    if (!this.secret || this.secret.length < 32) {
      throw new Error("GATEWAY_AUTH_SECRET must be set to at least 32 characters");
    }
  }

  createNonce(address) {
    this.assertReady();
    const wallet = normalizeAddress(address);
    const nonce = randomBytes(16).toString("hex");
    const issuedAt = Date.now();
    const expiresAt = issuedAt + this.nonceTtlMs;
    const message = [
      "ClusterFi gateway authentication",
      `Wallet: ${wallet}`,
      `Nonce: ${nonce}`,
      `Issued At: ${new Date(issuedAt).toISOString()}`,
      `Expires At: ${new Date(expiresAt).toISOString()}`,
    ].join("\n");

    this.nonces.set(nonce, { wallet, expiresAt, message });
    this.pruneNonces();
    return { wallet, nonce, message, expiresAt };
  }

  verifySignature({ address, nonce, signature }) {
    this.assertReady();
    const wallet = normalizeAddress(address);
    const entry = this.nonces.get(nonce);
    if (!entry || entry.wallet !== wallet || entry.expiresAt < Date.now()) {
      throw new Error("Invalid or expired auth nonce");
    }

    const recovered = normalizeAddress(ethers.verifyMessage(entry.message, signature));
    if (recovered !== wallet) {
      throw new Error("Signature does not match wallet");
    }

    this.nonces.delete(nonce);
    return this.createSession(wallet);
  }

  createSession(wallet) {
    const issuedAt = Date.now();
    const expiresAt = issuedAt + this.sessionTtlMs;
    const payload = {
      sub: normalizeAddress(wallet),
      iat: issuedAt,
      exp: expiresAt,
    };
    const encoded = base64UrlEncode(payload);
    return {
      token: `${encoded}.${sign(encoded, this.secret)}`,
      wallet: payload.sub,
      expiresAt,
    };
  }

  verifySession(token) {
    this.assertReady();
    const [encoded, signature] = String(token || "").split(".");
    if (!encoded || !signature || !safeEqual(signature, sign(encoded, this.secret))) {
      throw new Error("Invalid auth token");
    }
    const payload = base64UrlDecode(encoded);
    if (!payload.exp || Number(payload.exp) < Date.now()) {
      throw new Error("Auth token expired");
    }
    return { wallet: normalizeAddress(payload.sub) };
  }

  pruneNonces() {
    const now = Date.now();
    for (const [nonce, entry] of this.nonces.entries()) {
      if (entry.expiresAt < now) {
        this.nonces.delete(nonce);
      }
    }
  }
}

export function bearerToken(req) {
  const header = req.headers.authorization || "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : null;
}
