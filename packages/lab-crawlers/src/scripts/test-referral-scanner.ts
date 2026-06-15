import assert from 'node:assert/strict';
import { scanReferralText } from '../referral-scanner.js';

const sample = `
Направление
Пациент: Иванов Иван Иванович
Дата: 12.06.2026
Врач: терапевт

1. ОАК
2. Ферритин
3. ТТГ
4. 25-OH витамин D
5. Глюкоза крови

Сдавать натощак, кровь из вены
`;

const result = scanReferralText(sample);
const matchedNames = result.matched.map((match) => match.canonical?.nameRu).filter(Boolean);

assert.deepEqual(
  matchedNames.sort(),
  ['Витамин D', 'Глюкоза', 'Общий анализ крови', 'ТТГ', 'Ферритин'].sort(),
);
assert.equal(result.unmatched.length, 0);
assert.ok(result.ignored.some((match) => /Пациент/.test(match.rawText)));
assert.ok(result.ignored.some((match) => /натощак/.test(match.rawText)));

const complex = scanReferralText('Витамин D и ферритин');
assert.equal(complex.matched.length, 0);
assert.equal(complex.candidates.length, 1);
assert.equal(complex.candidates[0]?.canonical?.nameRu, 'Витамин D');

console.log(JSON.stringify({
  status: 'ok',
  matched: matchedNames,
  candidates: complex.candidates.map((match) => ({
    rawText: match.rawText,
    canonical: match.canonical?.nameRu,
    reason: match.reason,
  })),
  ignoredCount: result.ignored.length,
}, null, 2));
