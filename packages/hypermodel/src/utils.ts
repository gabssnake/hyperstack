// Some functions taken from FoalTS

import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto'
import { promisify } from 'util'

import { strictEqual } from 'assert'

export function generateHexToken(size: number) {
  return randomBytes(size).toString('hex')
}

/**
 * Legacy function to hash passwords. Only kept for backward compatibility.
 * @param password
 */
async function parsePassword(password: string): Promise<string> {
  const salt = (await promisify(randomBytes)(16)).toString('hex')
  const iterations = 100000
  const keylen = 64
  const digest = 'sha256'
  const derivedKey = await promisify(pbkdf2)(
    password,
    salt,
    iterations,
    keylen,
    digest
  )
  return `pbkdf2_${digest}$${iterations}$${salt}$${derivedKey.toString('hex')}`
}

/**
 * Hash a password using the PBKDF2 algorithm.
 *
 * Configured to use PBKDF2 + HMAC + SHA256.
 * The result is a 64 byte binary string (or hex if the legacy option is true).
 *
 * The random salt is 16 bytes long.
 * The number of iterations is 150000.
 * The length key is 32 bytes long.
 *
 * @export
 * @param {string} plainTextPassword - The password to hash.
 * @param {{ legacy?: boolean }} [options={}]
 * @returns {Promise<string>} The derived key with the algorithm name, the number of iterations and the salt.
 */
export async function hashPassword(
  plainTextPassword: string,
  options: { legacy?: boolean } = {}
): Promise<string> {
  // apply basic safeguard
  if (plainTextPassword.trim().length < 6) {
    throw new Error('Password invalid: too short')
  }

  if (options.legacy) {
    return parsePassword(plainTextPassword)
  }
  const saltBuffer = await promisify(randomBytes)(16)
  const iterations = 150000
  const keylen = 32
  const digest = 'sha256'
  const derivedKeyBuffer = await promisify(pbkdf2)(
    plainTextPassword,
    saltBuffer,
    iterations,
    keylen,
    digest
  )

  const salt = saltBuffer.toString('base64')
  const derivedKey = derivedKeyBuffer.toString('base64')
  return `pbkdf2_${digest}$${iterations}$${salt}$${derivedKey}`
}

/**
 * Compare a plain text password and a hash to see if they match.
 *
 * @export
 * @param {string} plainTextPassword - The password in clear text.
 * @param {string} passwordHash - The password hash generated by the `hashPassword` function.
 * @param {{ legacy?: boolean }} [options={}]
 * @returns {Promise<boolean>} True if the hash and the password match. False otherwise.
 */
export async function verifyPassword(
  plainTextPassword: string,
  passwordHash: string,
  options: { legacy?: boolean } = {}
): Promise<boolean> {
  const legacy = options.legacy || false
  const [algorithm, iterations, salt, derivedKey] = passwordHash.split('$')

  strictEqual(algorithm, 'pbkdf2_sha256', 'Invalid algorithm.')

  strictEqual(typeof iterations, 'string', 'Invalid password format.')
  strictEqual(typeof salt, 'string', 'Invalid password format.')
  strictEqual(typeof derivedKey, 'string', 'Invalid password format.')
  strictEqual(
    isNaN(parseInt(iterations, 10)),
    false,
    'Invalid password format.'
  )

  const saltBuffer = Buffer.from(salt, legacy ? 'hex' : 'base64')
  const derivedKeyBuffer = Buffer.from(derivedKey, legacy ? 'hex' : 'base64')
  const digest = 'sha256' // TODO: depends on the algorthim var
  const password = await promisify(pbkdf2)(
    plainTextPassword,
    legacy ? saltBuffer.toString('hex') : saltBuffer,
    parseInt(iterations, 10),
    derivedKeyBuffer.length,
    digest
  )
  return timingSafeEqual(password, derivedKeyBuffer)
}