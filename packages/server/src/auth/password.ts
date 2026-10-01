import bcrypt from "bcryptjs";
import { createHash } from 'node:crypto';

const SALT_ROUNDS = 10;

const COMMON_BREACHED_PASSWORDS = new Set([
  "password",
  "password123",
  "password1234",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyuiop",
  "qwerty123",
  "admin12345",
  "arcadeclash",
  "fugluck123",
  "fugluck2026",
  "letmein123",
  "welcome123",
  "iloveyou123",
  "sunshine1",
  "princess1",
  "dragon123",
  "football1",
  "master123",
  "abc12345",
  "shadow123",
]);

export type PasswordPolicyResult = {
  valid: boolean;
  error?: string;
};

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (typeof password !== "string") {
    return { valid: false, error: "Password must be a valid string." };
  }

  if (password.length < 8) {
    return { valid: false, error: "Password must be at least 8 characters long." };
  }

  if (password.length > 128) {
    return { valid: false, error: "Password must not exceed 128 characters." };
  }

  const normalized = password.toLowerCase().trim();

  // Check common breached password list
  if (COMMON_BREACHED_PASSWORDS.has(normalized)) {
    return {
      valid: false,
      error: "This password is too common or easily guessable. Please choose a stronger password or passphrase.",
    };
  }

  // Reject completely repetitive single-character strings (e.g. "aaaaaaaa", "11111111")
  if (/^(.)\1+$/.test(normalized)) {
    return {
      valid: false,
      error: "Password cannot be a single repeating character.",
    };
  }

  // Reject simple sequential numbers (e.g. "12345678", "87654321")
  if (normalized === "123456789" || normalized === "987654321" || normalized === "abcdefgh") {
    return {
      valid: false,
      error: "Password cannot be a simple sequential pattern.",
    };
  }

  return { valid: true };
}

export function hashPassword(password: string): Promise<string> {
  // Bcrypt truncates at 72 UTF-8 bytes. Version only the long-password format;
  // existing bcrypt records remain readable and ordinary passwords keep their format.
  if (Buffer.byteLength(password, 'utf8') > 72) {
    const digest = createHash('sha256').update('fugluck-password-v1\0').update(password).digest('base64');
    return bcrypt.hash(digest, SALT_ROUNDS).then(hash => `bcrypt-sha256-v1:${hash}`);
  }
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (typeof password !== 'string' || password.length > 128 || typeof hash !== 'string') return Promise.resolve(false);
  if (hash.startsWith('bcrypt-sha256-v1:')) {
    const digest = createHash('sha256').update('fugluck-password-v1\0').update(password).digest('base64');
    return bcrypt.compare(digest, hash.slice('bcrypt-sha256-v1:'.length));
  }
  return bcrypt.compare(password, hash);
}
