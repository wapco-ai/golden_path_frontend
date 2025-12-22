/**
 * @typedef {Object} UserDTO
 * @property {number} id
 * @property {string} phone
 * @property {string} [fullName]
 * @property {string} [email]
 * @property {string} [nationalId]
 * @property {string|null} [gender]
 * @property {string|null} [birthDate]
 * @property {Record<string, unknown>|null} [address]
 * @property {Record<string, unknown>|null} [preferences]
 * @property {string|null} [avatarUrl]
 * @property {boolean} [profileCompleted]
 * @property {string[]} [roles]
 * @property {string|null} [level]
 */

/**
 * @typedef {Object} AuthTokensDTO
 * @property {string} accessToken
 * @property {string} refreshToken
 * @property {number} expiresIn
 * @property {UserDTO} [user]
 */

/**
 * @typedef {Object} ApiErrorDTO
 * @property {string} [message]
 * @property {string} [code]
 * @property {Record<string, string[]|string>} [errors]
 */

export {};
