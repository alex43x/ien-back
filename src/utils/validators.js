const EMAIL_MAX_LENGTH = 254;
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const limpio = email.trim();
  if (limpio.length === 0 || limpio.length > EMAIL_MAX_LENGTH) return false;
  return EMAIL_REGEX.test(limpio);
}

function isValidPasswordLength(password, minLength = 8) {
  if (typeof password !== 'string') return false;
  return password.length >= minLength;
}

module.exports = {
  EMAIL_MAX_LENGTH,
  isValidEmail,
  isValidPasswordLength,
};
