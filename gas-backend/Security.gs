/**
 * ============================================================================
 * SMART ABSENSI GURU — SECURITY ENGINE (Security.gs)
 * ============================================================================
 * PIN hashing (HMAC-SHA256), JWT generation & verification,
 * device fingerprinting, token hashing for session storage.
 * ============================================================================
 */

var Security = {

  // ─── PIN HASHING ─────────────────────────────────────────────────────────

  /**
   * Hash PIN 6-digit dengan salt menggunakan HMAC-SHA256.
   * @param {string} pin  - PIN plaintext (6 digit)
   * @param {string} salt - Salt unik per-user (biasanya phone_number)
   * @returns {string} Hex-encoded hash
   */
  hashPIN: function(pin, salt) {
    var rawInput = pin + ":" + (salt || SECURITY.HMAC_SALT);
    var signature = Utilities.computeHmacSha256Signature(rawInput, SECURITY.JWT_SECRET);
    return signature
      .map(function(byte) {
        return ("0" + (byte & 0xff).toString(16)).slice(-2);
      })
      .join("");
  },

  // ─── TOKEN HASHING ──────────────────────────────────────────────────────

  /**
   * Hash token sebelum disimpan di sheet Sessions.
   * Jangan pernah simpan raw JWT di database.
   * @param {string} token
   * @returns {string} SHA-256 hash hex
   */
  hashToken: function(token) {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
    return digest
      .map(function(byte) {
        return ("0" + (byte & 0xff).toString(16)).slice(-2);
      })
      .join("");
  },

  // ─── DEVICE FINGERPRINT ─────────────────────────────────────────────────

  /**
   * Generates a composite device fingerprint hash.
   */
  generateDeviceFingerprint: function(deviceUUID, userAgent, timezoneOffset) {
    var raw = (deviceUUID || "") + "|" + (userAgent || "") + "|" + (timezoneOffset || "");
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw);
    return digest
      .map(function(byte) {
        return ("0" + (byte & 0xff).toString(16)).slice(-2);
      })
      .join("");
  },

  // ─── JWT TOKEN ──────────────────────────────────────────────────────────

  /**
   * Generate JWT session token.
   * @param {Object} userObj - User record from database
   * @returns {string} JWT token string
   */
  generateSessionToken: function(userObj) {
    var header = { alg: "HS256", typ: "JWT" };
    var now = Math.floor(Date.now() / 1000);
    var exp = now + SECURITY.JWT_EXPIRATION_HOURS * 3600;

    var payload = {
      sub: userObj.id,
      nip: userObj.nip,
      name: userObj.full_name,
      role: userObj.role,
      iat: now,
      exp: exp
    };

    var b64Header = Security._base64UrlEncode(JSON.stringify(header));
    var b64Payload = Security._base64UrlEncode(JSON.stringify(payload));
    var sigBytes = Utilities.computeHmacSha256Signature(
      b64Header + "." + b64Payload,
      SECURITY.JWT_SECRET
    );
    var b64Signature = Security._base64UrlEncodeBytes(sigBytes);

    return b64Header + "." + b64Payload + "." + b64Signature;
  },

  /**
   * Verify incoming JWT token.
   * @param {string} tokenString
   * @returns {{ valid: boolean, message: string, payload?: Object }}
   */
  verifyToken: function(tokenString) {
    if (!tokenString) {
      return { valid: false, message: ERRORS.AUTH_008.message };
    }

    var parts = tokenString.split(".");
    if (parts.length !== 3) {
      return { valid: false, message: "Format token tidak valid." };
    }

    var header = parts[0];
    var payload = parts[1];
    var signature = parts[2];

    var expectedSig = Security._base64UrlEncodeBytes(
      Utilities.computeHmacSha256Signature(header + "." + payload, SECURITY.JWT_SECRET)
    );

    if (signature !== expectedSig) {
      return { valid: false, message: "Tanda tangan token tidak sah." };
    }

    var payloadObj = JSON.parse(Security._base64UrlDecode(payload));
    var now = Math.floor(Date.now() / 1000);

    if (payloadObj.exp && payloadObj.exp < now) {
      return { valid: false, message: ERRORS.AUTH_007.message };
    }

    return { valid: true, message: "Token valid.", payload: payloadObj };
  },

  // ─── BASE64URL HELPERS ─────────────────────────────────────────────────

  _base64UrlEncode: function(str) {
    return Utilities.base64EncodeWebSafe(str).replace(/=+$/, "");
  },

  _base64UrlEncodeBytes: function(bytes) {
    return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, "");
  },

  _base64UrlDecode: function(str) {
    var decoded = Utilities.base64DecodeWebSafe(str);
    return Utilities.newBlob(decoded).getDataAsString();
  }
};
