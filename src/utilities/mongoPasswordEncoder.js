/**
 * MongoDB Password Encoder Utility
 *
 * This utility properly encodes passwords for MongoDB connection strings.
 * Unlike encodeURIComponent(), this ensures ALL special characters that
 * MongoDB requires are percent-encoded, including characters like '!' which
 * encodeURIComponent() treats as valid URI characters.
 *
 * @param {string} password - The password to encode
 * @returns {string} - The percent-encoded password safe for MongoDB connection strings
 */
function encodeMongoPassword(password) {
  if (!password || typeof password !== 'string') {
    return password;
  }

  // Manually encode each character that needs encoding for MongoDB connection strings
  // MongoDB requires special characters in passwords to be percent-encoded
  // Characters that must be encoded: ! @ # $ % & * ( ) [ ] = + , ; : ? / and space
  let encoded = '';
  for (let i = 0; i < password.length; i += 1) {
    const char = password[i];
    const charCode = char.charCodeAt(0);

    // Characters that need encoding (RFC 3986 reserved characters + MongoDB requirements)
    if (
      char === '!' ||
      char === '@' ||
      char === '#' ||
      char === '$' ||
      char === '%' ||
      char === '&' ||
      char === '*' ||
      char === '(' ||
      char === ')' ||
      char === '[' ||
      char === ']' ||
      char === '=' ||
      char === '+' ||
      char === ',' ||
      char === ';' ||
      char === ':' ||
      char === '?' ||
      char === '/' ||
      char === ' ' ||
      char === '\\'
    ) {
      // Percent-encode the character
      encoded += `%${charCode.toString(16).toUpperCase().padStart(2, '0')}`;
    } else if (charCode > 127) {
      // Encode non-ASCII characters using encodeURIComponent
      encoded += encodeURIComponent(char);
    } else {
      // Keep ASCII alphanumeric and other safe characters as-is
      encoded += char;
    }
  }

  return encoded;
}

module.exports = encodeMongoPassword;
