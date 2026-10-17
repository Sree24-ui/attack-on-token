// Password rules, revealed one at a time. Shared with test.js.
const MONTHS = /january|february|march|april|may|june|july|august|september|october|november|december/i;
const isPrime = n => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
const digitSum = p => (p.match(/\d/g) ?? []).reduce((sum, d) => sum + Number(d), 0);

export const RULES = [
  { text: () => 'At least 8 characters.', test: p => [...p].length >= 8 },
  { text: () => 'Must include a number.', test: p => /\d/.test(p) },
  { text: () => 'Must include an uppercase letter.', test: p => /[A-Z]/.test(p) },
  { text: p => `The digits must add up to 13. (Currently ${digitSum(p)}.)`, test: p => digitSum(p) === 13 },
  { text: () => 'Must include a month of the year.', test: p => MONTHS.test(p) },
  { text: () => 'Must include "titan" spelled backwards.', test: p => /natit/i.test(p) },
  { text: () => 'Must include an emoji. The Titan is lonely.', test: p => /\p{Extended_Pictographic}/u.test(p) },
  { text: p => `Length must be a prime number. (Currently ${[...p].length}.)`, test: p => isPrime([...p].length) },
];
