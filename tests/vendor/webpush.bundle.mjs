// @negrel/webpush 0.5.0 (MIT, © 2024 Alexandre Negrel — https://github.com/negrel/webpush), bundled with its
// dependencies for the tests only. Supabase loads the same version from jsr.io; this copy never ships to the app.
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// std/encoding/_common64.ts
var padding = "=".charCodeAt(0);
var alphabet = {
  base64: new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"),
  base64url: new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_")
};
var rAlphabet = {
  base64: new Uint8Array(128).fill(64),
  // alphabet.base64.length
  base64url: new Uint8Array(128).fill(64)
};
alphabet.base64.forEach((byte, i) => rAlphabet.base64[byte] = i);
alphabet.base64url.forEach((byte, i) => rAlphabet.base64url[byte] = i);
function calcSizeBase64(originalSize) {
  return ((originalSize + 2) / 3 | 0) * 4;
}
function encode(buffer, i, o, alphabet4, padding4) {
  i += 2;
  for (; i < buffer.length; i += 3) {
    const x = buffer[i - 2] << 16 | buffer[i - 1] << 8 | buffer[i];
    buffer[o++] = alphabet4[x >> 18];
    buffer[o++] = alphabet4[x >> 12 & 63];
    buffer[o++] = alphabet4[x >> 6 & 63];
    buffer[o++] = alphabet4[x & 63];
  }
  switch (i) {
    case buffer.length + 1: {
      const x = buffer[i - 2] << 16;
      buffer[o++] = alphabet4[x >> 18];
      buffer[o++] = alphabet4[x >> 12 & 63];
      buffer[o++] = padding4;
      buffer[o++] = padding4;
      break;
    }
    case buffer.length: {
      const x = buffer[i - 2] << 16 | buffer[i - 1] << 8;
      buffer[o++] = alphabet4[x >> 18];
      buffer[o++] = alphabet4[x >> 12 & 63];
      buffer[o++] = alphabet4[x >> 6 & 63];
      buffer[o++] = padding4;
      break;
    }
  }
  return o;
}
function decode(buffer, i, o, alphabet4, padding4) {
  for (let x = buffer.length - 2; x < buffer.length; ++x) {
    if (buffer[x] === padding4) {
      for (let y = x + 1; y < buffer.length; ++y) {
        if (buffer[y] !== padding4) {
          throw new TypeError(
            `Cannot decode input as base64: Invalid character (${String.fromCharCode(buffer[y])})`
          );
        }
      }
      buffer = buffer.subarray(0, x);
      break;
    }
  }
  if ((buffer.length - o) % 4 === 1) {
    throw new RangeError(
      `Cannot decode input as base64: Length (${buffer.length - o}), excluding padding, must not have a remainder of 1 when divided by 4`
    );
  }
  i += 3;
  for (; i < buffer.length; i += 4) {
    const x = getByte(buffer[i - 3], alphabet4) << 18 | getByte(buffer[i - 2], alphabet4) << 12 | getByte(buffer[i - 1], alphabet4) << 6 | getByte(buffer[i], alphabet4);
    buffer[o++] = x >> 16;
    buffer[o++] = x >> 8 & 255;
    buffer[o++] = x & 255;
  }
  switch (i) {
    case buffer.length + 1: {
      const x = getByte(buffer[i - 3], alphabet4) << 18 | getByte(buffer[i - 2], alphabet4) << 12;
      buffer[o++] = x >> 16;
      break;
    }
    case buffer.length: {
      const x = getByte(buffer[i - 3], alphabet4) << 18 | getByte(buffer[i - 2], alphabet4) << 12 | getByte(buffer[i - 1], alphabet4) << 6;
      buffer[o++] = x >> 16;
      buffer[o++] = x >> 8 & 255;
      break;
    }
  }
  return o;
}
function getByte(char, alphabet4) {
  const byte = alphabet4[char] ?? 64;
  if (byte === 64) {
    throw new TypeError(
      `Cannot decode input as base64: Invalid character (${String.fromCharCode(char)})`
    );
  }
  return byte;
}

// std/encoding/_common_detach.ts
function detach(buffer, maxSize) {
  const originalSize = buffer.length;
  if (buffer.byteOffset) {
    const b = new Uint8Array(buffer.buffer);
    b.set(buffer);
    buffer = b.subarray(0, originalSize);
  }
  buffer = new Uint8Array(buffer.buffer.transfer(maxSize));
  buffer.set(buffer.subarray(0, originalSize), maxSize - originalSize);
  return [buffer, maxSize - originalSize];
}

// std/encoding/base64url.ts
var padding2 = "=".charCodeAt(0);
var alphabet2 = new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_");
var rAlphabet2 = new Uint8Array(128).fill(64);
alphabet2.forEach((byte, i) => rAlphabet2[byte] = i);
function encodeBase64Url(data) {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) data = new Uint8Array(data).slice();
  else data = data.slice();
  const [output, i] = detach(
    data,
    calcSizeBase64(data.length)
  );
  let o = encode(output, i, 0, alphabet2, padding2);
  o = output.indexOf(padding2, o - 2);
  return new TextDecoder().decode(
    // deno-lint-ignore no-explicit-any
    o > 0 ? new Uint8Array(output.buffer.transfer(o)) : output
  );
}
function decodeBase64Url(b64url) {
  const output = new TextEncoder().encode(b64url);
  return new Uint8Array(output.buffer.transfer(decode(output, 0, 0, rAlphabet2, padding2)));
}

// std/bytes/mod.ts
var mod_exports = {};
__export(mod_exports, {
  concat: () => concat,
  copy: () => copy,
  endsWith: () => endsWith,
  equals: () => equals,
  includesNeedle: () => includesNeedle,
  indexOfNeedle: () => indexOfNeedle,
  lastIndexOfNeedle: () => lastIndexOfNeedle,
  repeat: () => repeat,
  startsWith: () => startsWith
});

// std/bytes/concat.ts
function concat(buffers) {
  let length = 0;
  for (const buffer of buffers) {
    length += buffer.length;
  }
  const output = new Uint8Array(length);
  let index = 0;
  for (const buffer of buffers) {
    output.set(buffer, index);
    index += buffer.length;
  }
  return output;
}

// std/bytes/copy.ts
function copy(src, dst, offset = 0) {
  offset = Math.max(0, Math.min(offset, dst.byteLength));
  const dstBytesAvailable = dst.byteLength - offset;
  if (src.byteLength > dstBytesAvailable) {
    src = src.subarray(0, dstBytesAvailable);
  }
  dst.set(src, offset);
  return src.byteLength;
}

// std/bytes/ends_with.ts
function endsWith(source, suffix) {
  const diff = source.length - suffix.length;
  if (diff < 0) {
    return false;
  }
  for (let i = suffix.length - 1; i >= 0; i--) {
    if (source[diff + i] !== suffix[i]) {
      return false;
    }
  }
  return true;
}

// std/bytes/equals.ts
function equalsNaive(a, b) {
  for (let i = 0; i < b.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
function equals32Bit(a, b) {
  const len = a.length;
  const compactOffset = 3 - (a.byteOffset + 3) % 4;
  const compactLen = Math.floor((len - compactOffset) / 4);
  const compactA = new Uint32Array(
    a.buffer,
    a.byteOffset + compactOffset,
    compactLen
  );
  const compactB = new Uint32Array(
    b.buffer,
    b.byteOffset + compactOffset,
    compactLen
  );
  for (let i = 0; i < compactOffset; i++) {
    if (a[i] !== b[i]) return false;
  }
  for (let i = 0; i < compactA.length; i++) {
    if (compactA[i] !== compactB[i]) return false;
  }
  for (let i = compactOffset + compactLen * 4; i < len; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
var THRESHOLD_32_BIT = 160;
function equals(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  return a.length >= THRESHOLD_32_BIT && a.byteOffset % 4 === b.byteOffset % 4 ? equals32Bit(a, b) : equalsNaive(a, b);
}

// std/bytes/index_of_needle.ts
function indexOfNeedle(source, needle, start = 0) {
  if (start < 0) {
    start = Math.max(0, source.length + start);
  }
  if (needle.length > source.length - start) {
    return -1;
  }
  const s = needle[0];
  for (let i = start; i < source.length; i++) {
    if (source[i] !== s) continue;
    let matched = 1;
    let j = i + 1;
    while (matched < needle.length && source[j] === needle[j - i]) {
      matched++;
      j++;
    }
    if (matched === needle.length) {
      return i;
    }
  }
  return -1;
}

// std/bytes/includes_needle.ts
function includesNeedle(source, needle, start = 0) {
  return indexOfNeedle(source, needle, start) !== -1;
}

// std/bytes/last_index_of_needle.ts
function lastIndexOfNeedle(source, needle, start = source.length - 1) {
  if (start < 0) {
    return -1;
  }
  if (start >= source.length) {
    start = source.length - 1;
  }
  const e = needle[needle.length - 1];
  for (let i = start; i >= 0; i--) {
    if (source[i] !== e) continue;
    let matched = 1;
    let j = i;
    while (matched < needle.length && source[--j] === needle[needle.length - 1 - (i - j)]) {
      matched++;
    }
    if (matched === needle.length) {
      return i - needle.length + 1;
    }
  }
  return -1;
}

// std/bytes/repeat.ts
function repeat(source, count) {
  if (count < 0 || !Number.isInteger(count)) {
    throw new RangeError("Count must be a non-negative integer");
  }
  const repeated = new Uint8Array(source.length * count);
  let offset = 0;
  while (offset < repeated.length) {
    offset += copy(source, repeated, offset);
  }
  return repeated;
}

// std/bytes/starts_with.ts
function startsWith(source, prefix) {
  if (prefix.length > source.length) {
    return false;
  }
  for (let i = 0; i < prefix.length; i++) {
    if (source[i] !== prefix[i]) return false;
  }
  return true;
}

// http-ece/mod.ts
var mod_exports2 = {};
__export(mod_exports2, {
  CEK_INFO: () => CEK_INFO,
  DEFAULT_RECORD_SIZE: () => DEFAULT_RECORD_SIZE,
  ECECrypto: () => ECECrypto,
  ExceedRecordSequenceNumberError: () => ExceedRecordSequenceNumberError,
  HEADER_LENGTH_MIN: () => HEADER_LENGTH_MIN,
  Header: () => Header,
  HeaderSizeError: () => HeaderSizeError,
  IDLEN_LENGTH: () => IDLEN_LENGTH,
  InvalidDataSizeError: () => InvalidDataSizeError,
  KEY_LENGTH: () => KEY_LENGTH,
  NONCE_INFO: () => NONCE_INFO,
  NONCE_LENGTH: () => NONCE_LENGTH,
  ONE_BYTE: () => ONE_BYTE,
  PlainTextRecord: () => PlainTextRecord,
  RECORD_SIZE_MAX: () => RECORD_SIZE_MAX,
  RECORD_SIZE_MIN: () => RECORD_SIZE_MIN,
  RS_LENGTH: () => RS_LENGTH,
  RecordIterable: () => RecordIterable,
  RecordSizeError: () => RecordSizeError,
  SALT_LENGTH: () => SALT_LENGTH,
  Salt: () => Salt,
  SaltLengthError: () => SaltLengthError,
  TAG_LENGTH: () => TAG_LENGTH,
  WithPaddingRecordIterable: () => WithPaddingRecordIterable,
  decrypt: () => decrypt,
  encrypt: () => encrypt,
  padRecord: () => padRecord,
  unpadRecord: () => unpadRecord
});

// http-ece/const.ts
var SALT_LENGTH = 16;
var RS_LENGTH = 4;
var IDLEN_LENGTH = 1;
var KEY_LENGTH = 16;
var TAG_LENGTH = 16;
var NONCE_LENGTH = 12;
var HEADER_LENGTH_MIN = SALT_LENGTH + RS_LENGTH + IDLEN_LENGTH;
var DEFAULT_RECORD_SIZE = 1024 * 64;
var RECORD_SIZE_MIN = 18;
var RECORD_SIZE_MAX = 2 ** 36 - 31;
var encoder = new TextEncoder();
var CEK_INFO = encoder.encode(
  "Content-Encoding: aes128gcm\0"
);
var NONCE_INFO = encoder.encode(
  "Content-Encoding: nonce\0"
);
var ONE_BYTE = encoder.encode("");

// std/encoding/base64.ts
var padding3 = "=".charCodeAt(0);
var alphabet3 = new TextEncoder().encode("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/");
var rAlphabet3 = new Uint8Array(128).fill(64);
alphabet3.forEach((byte, i) => rAlphabet3[byte] = i);
function encodeBase64(data) {
  if (typeof data === "string") {
    data = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) data = new Uint8Array(data).slice();
  else data = data.slice();
  const [output, i] = detach(
    data,
    calcSizeBase64(data.length)
  );
  encode(output, i, 0, alphabet3, padding3);
  return new TextDecoder().decode(output);
}
function decodeBase64(b64) {
  const output = new TextEncoder().encode(b64);
  return new Uint8Array(output.buffer.transfer(decode(output, 0, 0, rAlphabet3, padding3)));
}

// http-ece/salt.ts
var SaltLengthError = class extends Error {
};
var Salt = class extends Uint8Array {
  constructor(salt) {
    if (salt === void 0) {
      super(SALT_LENGTH);
      crypto.getRandomValues(this);
      return;
    }
    if (salt.byteLength != SALT_LENGTH) {
      throw new SaltLengthError(
        `salt length must be ${SALT_LENGTH}: got ${salt.byteLength}`
      );
    }
    if (salt instanceof ArrayBuffer) {
      const copy2 = new Uint8Array(SALT_LENGTH);
      mod_exports.copy(new Uint8Array(salt), copy2);
      super(copy2);
      return;
    }
    super(SALT_LENGTH);
    this.set(salt, 0);
  }
  equals(other) {
    return mod_exports.equals(this, other);
  }
};

// http-ece/header.ts
var Header = class _Header {
  salt;
  rs;
  keyid;
  get idlen() {
    return this.keyid.byteLength;
  }
  get byteLength() {
    return HEADER_LENGTH_MIN + this.idlen;
  }
  constructor({
    salt = new Salt(),
    rs = DEFAULT_RECORD_SIZE,
    keyid = new Uint8Array()
  }) {
    if (rs < RECORD_SIZE_MIN || rs > RECORD_SIZE_MAX) {
      throw new RecordSizeError(rs);
    }
    this.salt = salt instanceof Salt ? salt : new Salt(salt);
    this.rs = rs;
    this.keyid = keyid;
  }
  static fromBytes(buf) {
    if (buf.byteLength < HEADER_LENGTH_MIN) {
      throw new HeaderSizeError(buf);
    }
    const dv = new DataView(buf);
    let cur = 0;
    const salt = dv.buffer.slice(0, SALT_LENGTH);
    cur += SALT_LENGTH;
    const rs = dv.getUint32(cur);
    cur += RS_LENGTH;
    const idlen = dv.getUint8(cur);
    cur += IDLEN_LENGTH;
    const keyid = dv.buffer.slice(cur, cur + idlen);
    cur += idlen;
    return new _Header({
      salt: new Salt(salt),
      rs,
      keyid: new Uint8Array(keyid)
    });
  }
  static fromBase64(b) {
    return _Header.fromBytes(decodeBase64(b).buffer);
  }
  static fromBase64Url(b) {
    return _Header.fromBytes(decodeBase64Url(b).buffer);
  }
  toBytes() {
    const bytes = new Uint8Array(this.byteLength);
    const dv = new DataView(bytes.buffer);
    bytes.set(this.salt);
    dv.setUint32(SALT_LENGTH, this.rs);
    dv.setUint8(SALT_LENGTH + RS_LENGTH, this.idlen);
    bytes.set(this.keyid, SALT_LENGTH + RS_LENGTH + IDLEN_LENGTH);
    return bytes.buffer;
  }
  toBase64() {
    return encodeBase64(this.toBytes());
  }
  toBase64Url() {
    return encodeBase64Url(this.toBytes());
  }
  equals(other) {
    return mod_exports.equals(this.salt, other.salt) && this.rs === other.rs && mod_exports.equals(this.keyid, other.keyid);
  }
};
var RecordSizeError = class extends Error {
  constructor(rs) {
    super(
      `record size must be comprised between ${RECORD_SIZE_MIN} and ${RECORD_SIZE_MAX}: got ${rs}`
    );
  }
};
var HeaderSizeError = class extends Error {
  constructor(bytes) {
    super(
      `header block must be at least ${HEADER_LENGTH_MIN} byte long: got ${bytes.byteLength}`
    );
  }
};

// http-ece/ece_crypto.ts
var ECECrypto = class {
  info;
  nonceInfo;
  header;
  crypto;
  // Input Keying Material
  ikm;
  // Pseudo Random Key
  prk = null;
  // Content Encryption Key
  cek = null;
  // Number once
  nonce = null;
  constructor(ikm, {
    header = new Header({}),
    info = CEK_INFO,
    nonceInfo = NONCE_INFO,
    subtleCrypto = crypto.subtle
  }) {
    this.ikm = ikm;
    this.info = mod_exports.concat([info, ONE_BYTE]);
    this.header = header instanceof Header ? header : new Header(header);
    this.crypto = subtleCrypto;
    this.nonceInfo = mod_exports.concat([nonceInfo, ONE_BYTE]);
  }
  async getPRK() {
    if (this.prk === null) {
      this.prk = await this.hmacSha256(
        this.header.salt.buffer,
        this.ikm
      );
    }
    return this.prk;
  }
  async getCEK() {
    let rawCEK = null;
    if (this.cek === null) {
      rawCEK = await this.hmacSha256(
        await this.getPRK(),
        this.info,
        KEY_LENGTH
      );
      this.cek = await this.crypto.importKey(
        "raw",
        rawCEK,
        { name: "AES-GCM" },
        false,
        ["encrypt", "decrypt"]
      );
    }
    return this.cek;
  }
  async getNonce() {
    if (this.nonce === null) {
      this.nonce = await this.hmacSha256(
        await this.getPRK(),
        this.nonceInfo,
        NONCE_LENGTH
      );
    }
    return this.nonce;
  }
  async deriveNonce(seq) {
    if (seq > 4294967295) {
      throw new ExceedRecordSequenceNumberError(seq);
    }
    const nonce = new DataView((await this.getNonce()).slice(0));
    const m = nonce.getUint32(nonce.byteLength - 4);
    const xor = (m ^ seq) >>> 0;
    nonce.setUint32(nonce.byteLength - 4, xor);
    return new Uint8Array(nonce.buffer);
  }
  async hmacSha256(secret, body, length) {
    if (secret instanceof ArrayBuffer) {
      secret = await this.crypto.importKey(
        "raw",
        secret,
        {
          name: "HMAC",
          hash: "SHA-256"
        },
        false,
        ["sign"]
      );
    }
    const result = await this.crypto.sign("HMAC", secret, body);
    if (length !== null) return result.slice(0, length);
    return result;
  }
  /** Encrypt a single record.
   * @param data is padded data of size rs to encrypt
   * @param seq is the record sequence number
   * @returns encrypted data
   */
  async encryptRecord(data, seq) {
    return this._encryptRecord(data, seq, await this.getCEK());
  }
  async _encryptRecord(data, seq, cek) {
    const crypted = await this.crypto.encrypt(
      {
        name: "AES-GCM",
        iv: await this.deriveNonce(seq),
        tagLength: 128
      },
      cek,
      data
    );
    return crypted;
  }
  /** Decrypt a single record.
   * @param crypted is the crypted record
   * @param seq is the record sequence number
   * @returns decrypted record
   */
  async decryptRecord(crypted, seq) {
    return this._decryptRecord(crypted, seq, await this.getCEK());
  }
  async _decryptRecord(crypted, seq, cek) {
    const data = await this.crypto.decrypt(
      {
        name: "AES-GCM",
        iv: await this.deriveNonce(seq),
        tagLength: 128
      },
      cek,
      crypted
    );
    return data;
  }
};
var ExceedRecordSequenceNumberError = class extends Error {
  constructor(seq) {
    super(`record sequence number exceed limit (${4294967295}): got ${seq}`);
  }
};

// http-ece/ece.ts
async function encrypt(data, secret, options) {
  const crypto2 = new ECECrypto(secret, options || {});
  const iterable = data instanceof RecordIterable ? data : new WithPaddingRecordIterable(
    data,
    crypto2.header.rs
  );
  const header = crypto2.header.toBytes();
  const result = new Uint8Array(
    header.byteLength + iterable.length * crypto2.header.rs
  );
  result.set(new Uint8Array(header));
  let i = 0;
  let cursor = header.byteLength;
  for (const record of iterable) {
    const crypted = await crypto2.encryptRecord(record, i);
    result.set(new Uint8Array(crypted), cursor);
    cursor += crypted.byteLength;
    i++;
  }
  return result.slice(0, cursor).buffer;
}
var PlainTextRecord = class extends ArrayBuffer {
};
var RecordIterable = class {
};
var WithPaddingRecordIterable = class extends RecordIterable {
  length;
  data;
  // Record size without TAG_LENGTH but with padding
  rs;
  // Record size without TAG_LENGTH and padding
  ds;
  extraPadding;
  constructor(data, rs, extraPadding = 0) {
    super();
    this.rs = rs - TAG_LENGTH;
    if (extraPadding < 0 || this.rs - 1 <= extraPadding) {
      throw new Error(
        `extra padding must be comprised between 0 and ${this.rs - 2}: got ${extraPadding}`
      );
    }
    this.extraPadding = extraPadding;
    this.ds = this.rs - 1 - extraPadding;
    this.length = Math.ceil(data.byteLength / this.ds);
    const lastRecordSize = data.byteLength - this.length * this.ds;
    if (lastRecordSize <= extraPadding && this.length > 1) this.length--;
    this.data = data;
  }
  [Symbol.iterator]() {
    let cursor = 0;
    let done = false;
    let record = null;
    return {
      next: (..._args) => {
        if (done) return { done, value: record };
        done = cursor + this.rs >= this.data.byteLength;
        const recordData = this.data.slice(
          cursor,
          done ? void 0 : cursor + this.ds
        );
        record = padRecord(
          new Uint8Array(recordData),
          done ? 0 : this.extraPadding,
          done ? 2 : 1
        );
        cursor += this.ds;
        return { value: record };
      }
    };
  }
};
var InvalidDataSizeError = class extends Error {
  constructor(maxDataSize, data) {
    super(`data size must be less than ${maxDataSize}: got ${data.byteLength}`);
  }
};
function padRecord(record, padLen, padDelimiter) {
  const result = new ArrayBuffer(record.byteLength + padLen + 1);
  const bytesArr = new Uint8Array(result);
  bytesArr.set(new Uint8Array(record), 0);
  bytesArr.set(new Uint8Array(padLen), record.byteLength);
  bytesArr[record.byteLength] = padDelimiter;
  return result;
}
function unpadRecord(record) {
  const r = new Uint8Array(record);
  for (let i = record.byteLength - 1; i >= 0; i--) {
    if (r[i] === 1 || r[i] === 2) {
      return record.slice(0, i);
    }
  }
  return record;
}
async function decrypt(data, secret, headerOrOptions) {
  let options;
  if (headerOrOptions instanceof Header) {
    options = { header: headerOrOptions };
  } else {
    options = headerOrOptions || {};
  }
  options.header ||= Header.fromBytes(data);
  const crypto2 = new ECECrypto(secret, options);
  const header = crypto2.header;
  data = data.slice(header.byteLength);
  const recordsNum = data.byteLength / header.rs;
  let resultCursor = 0;
  const result = new Uint8Array(
    recordsNum * (header.rs - TAG_LENGTH)
  );
  let cursor = 0;
  for (let i = 0; i < recordsNum; i++) {
    const decryptedRecord = unpadRecord(
      await crypto2.decryptRecord(
        data.slice(cursor, cursor + header.rs),
        i
      )
    );
    cursor += header.rs;
    result.set(new Uint8Array(decryptedRecord), resultCursor);
    resultCursor += decryptedRecord.byteLength;
  }
  return result.slice(0, resultCursor);
}

// webpush/vapid.ts
var vapidKeysAlgo = {
  name: "ECDSA",
  namedCurve: "P-256"
};
async function generateVapidKeys({ extractable = false, crypto: crypto2 = globalThis.crypto.subtle } = {}) {
  return await crypto2.generateKey(
    vapidKeysAlgo,
    extractable,
    ["sign", "verify"]
  );
}
async function importVapidKeys(exportedKeys, { crypto: crypto2 = globalThis.crypto.subtle, extractable = false } = {}) {
  return {
    publicKey: await crypto2.importKey(
      "jwk",
      exportedKeys.publicKey,
      vapidKeysAlgo,
      true,
      ["verify"]
    ),
    privateKey: await crypto2.importKey(
      "jwk",
      exportedKeys.privateKey,
      vapidKeysAlgo,
      extractable,
      ["sign"]
    )
  };
}
async function exportVapidKeys(keys, { crypto: crypto2 = globalThis.crypto.subtle } = {}) {
  return {
    publicKey: await crypto2.exportKey("jwk", keys.publicKey),
    privateKey: await crypto2.exportKey("jwk", keys.privateKey)
  };
}
async function exportApplicationServerKey(keys, { crypto: crypto2 = globalThis.crypto.subtle } = {}) {
  const k = await crypto2.exportKey("raw", keys.publicKey);
  return encodeBase64Url(k);
}

// webpush/crypto_utils.ts
async function hmacSha256Digest(crypto2, secret, body, length) {
  if (secret instanceof ArrayBuffer) {
    secret = await crypto2.importKey(
      "raw",
      secret,
      {
        name: "HMAC",
        hash: "SHA-256"
      },
      false,
      ["sign"]
    );
  }
  const result = await crypto2.sign("HMAC", secret, body);
  if (length !== null) return result.slice(0, length);
  return result;
}
function hkdfSha256Extract(crypto2, salt, ikm) {
  if (salt.byteLength === 0) {
    salt = new Uint8Array(256).fill(0).buffer.slice(0);
  }
  return hmacSha256Digest(crypto2, salt, ikm);
}
async function hkdfSha256Expand(crypto2, prk, info, length) {
  const infoBytes = new Uint8Array(info);
  let t = new Uint8Array(0);
  let okm = new Uint8Array(0);
  let i = 0;
  while (okm.byteLength < length) {
    i++;
    t = new Uint8Array(
      await hmacSha256Digest(crypto2, prk, mod_exports.concat([t, infoBytes]))
    );
    okm = mod_exports.concat([okm, t]);
  }
  return okm.slice(0, length);
}
async function ecdh(crypto2, { privateKey, publicKey }) {
  const ecdhKey = await crypto2.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    {
      name: "AES-GCM",
      length: 256
    },
    true,
    ["encrypt", "decrypt"]
  );
  return crypto2.exportKey("raw", ecdhKey);
}
var encoder2 = new TextEncoder();
async function forgeJwt(key, payload, { crypto: crypto2 = globalThis.crypto.subtle } = {}) {
  const jwt = [{ typ: "JWT", alg: "ES256" }, payload].map(
    (p) => encodeBase64Url(JSON.stringify(p))
  ).join(".");
  const digest = await crypto2.sign(
    { "name": "ECDSA", "hash": "SHA-256" },
    key,
    encoder2.encode(jwt)
  );
  const signature = encodeBase64Url(digest);
  return jwt + "." + signature;
}

// webpush/subscriber.ts
var encoder3 = new TextEncoder();
var PushSubscriber = class {
  as;
  subscription;
  uaPublicKey = null;
  ecdhSecret = null;
  constructor(as, subscription) {
    this.as = as;
    this.subscription = subscription;
  }
  uaPublicKeyRaw() {
    return decodeBase64Url(this.subscription.keys.p256dh);
  }
  authSecret() {
    return decodeBase64Url(this.subscription.keys.auth).slice(0).buffer;
  }
  async getUaPublicKey() {
    if (this.uaPublicKey === null) {
      this.uaPublicKey = await this.as.crypto.importKey(
        "raw",
        this.uaPublicKeyRaw(),
        {
          "name": "ECDH",
          namedCurve: "P-256"
        },
        true,
        []
      );
    }
    return this.uaPublicKey;
  }
  async getEcdhSecret() {
    if (this.ecdhSecret === null) {
      this.ecdhSecret = await ecdh(this.as.crypto, {
        privateKey: this.as.keys.privateKey,
        publicKey: await this.getUaPublicKey()
      });
    }
    return this.ecdhSecret;
  }
  async getKeyInfo() {
    return mod_exports.concat([
      encoder3.encode("WebPush: info\0"),
      this.uaPublicKeyRaw(),
      await this.as.getPublicKeyRaw()
    ]);
  }
  getSubscriptionOrigin() {
    return new URL(this.subscription.endpoint).origin;
  }
  forgeVapidToken() {
    return forgeJwt(this.as.vapidKeys.privateKey, {
      sub: this.as.contactInformation,
      aud: this.getSubscriptionOrigin(),
      exp: Math.round(Date.now() / 1e3) + 3600
      // Expire in 1 hour.
    });
  }
  async pushMessage(message, { urgency = "normal" /* Normal */, ttl = 2419200, topic }) {
    const prkKey = await hkdfSha256Extract(
      this.as.crypto,
      this.authSecret(),
      await this.getEcdhSecret()
    );
    const ikm = await hkdfSha256Expand(
      this.as.crypto,
      prkKey,
      mod_exports.concat([await this.getKeyInfo(), mod_exports2.ONE_BYTE]),
      32
    );
    const record = await mod_exports2.encrypt(message, ikm, {
      header: {
        keyid: await this.as.getPublicKeyRaw()
      }
    });
    const headers = {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      "Urgency": urgency,
      TTL: ttl.toFixed(0),
      Authorization: `vapid t=${await this.forgeVapidToken()}, k=${encodeBase64Url(
        await this.as.getVapidPublicKeyRaw()
      )}`
    };
    if (topic !== void 0) {
      headers["Topic"] = topic;
    }
    const response = await fetch(this.subscription.endpoint, {
      method: "POST",
      headers,
      body: record
    });
    if (!response.ok) {
      throw new PushMessageError(response);
    }
  }
  pushTextMessage(message, options) {
    return this.pushMessage(encoder3.encode(message), options);
  }
};
var PushMessageError = class extends Error {
  response;
  constructor(response) {
    super();
    this.response = response;
  }
  /**
   * isGone returns true if subscription doesn't exist anymore.
   */
  isGone() {
    return this.response.status === 410;
  }
  toString() {
    return `pushing message failed: ${this.response.status} ${this.response.statusText}`;
  }
};
var Urgency = /* @__PURE__ */ ((Urgency2) => {
  Urgency2["VeryLow"] = "very-low";
  Urgency2["Low"] = "low";
  Urgency2["Normal"] = "normal";
  Urgency2["High"] = "high";
  return Urgency2;
})(Urgency || {});

// webpush/application_server.ts
var ApplicationServer = class _ApplicationServer {
  crypto;
  // Application Server (AS) keys.
  keys;
  // AS public key in raw format.
  publicKeyRaw = null;
  // VAPID AS contact information.
  contactInformation;
  vapidKeys;
  publicVapidKeyRaw = null;
  constructor({
    crypto: crypto2 = globalThis.crypto.subtle,
    keys,
    contactInformation,
    vapidKeys
  }) {
    this.crypto = crypto2;
    this.contactInformation = contactInformation;
    this.keys = keys;
    this.vapidKeys = vapidKeys;
  }
  static async new({ crypto: crypto2 = globalThis.crypto.subtle, contactInformation, vapidKeys }) {
    const keys = await crypto2.generateKey(
      {
        name: "ECDH",
        namedCurve: "P-256"
      },
      false,
      ["deriveKey"]
    );
    return new _ApplicationServer({
      crypto: crypto2,
      keys,
      contactInformation,
      vapidKeys
    });
  }
  async getPublicKeyRaw() {
    if (this.publicKeyRaw === null) {
      this.publicKeyRaw = new Uint8Array(
        await this.crypto.exportKey(
          "raw",
          this.keys.publicKey
        )
      );
    }
    return this.publicKeyRaw;
  }
  async getVapidPublicKeyRaw() {
    if (this.publicVapidKeyRaw === null) {
      this.publicVapidKeyRaw = new Uint8Array(
        await this.crypto.exportKey(
          "raw",
          this.vapidKeys.publicKey
        )
      );
    }
    return this.publicVapidKeyRaw;
  }
  subscribe(sub) {
    return new PushSubscriber(this, sub);
  }
};
export {
  ApplicationServer,
  PushMessageError,
  PushSubscriber,
  Urgency,
  exportApplicationServerKey,
  exportVapidKeys,
  generateVapidKeys,
  importVapidKeys
};
