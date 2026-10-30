// Keep StatiCrypt's authenticated encryption format and password derivation together.
// These package-internal imports are deliberately pinned and covered by round-trip tests.
import engine from 'staticrypt/lib/cryptoEngine.js';
import codecModule from 'staticrypt/lib/codec.js';
const codec = codecModule.init(engine);
export const deriveKey = engine.hashPassword;
export const randomSalt = engine.generateRandomSalt;
export const encryptWithKey = codec.encodeWithHashedPassword;
export function decryptWithKey(payload, key, salt) {
  // New exports never use legacy key derivation; disable backwards-compatible retries.
  return codec.decode(payload, key, salt, 2);
}
