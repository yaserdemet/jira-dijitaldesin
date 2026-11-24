import test from 'node:test';
import assert from 'node:assert/strict';
import { istanbulDayStart, requestToken, tokenMatches } from '../src/lib/daily-summary';

test('gün başlangıcı İstanbul saatine göre hesaplanır', () => {
  // UTC 22:30 = İstanbul ertesi gün 01:30
  assert.equal(istanbulDayStart(new Date('2026-11-24T22:30:00Z')), '2026-11-24T21:00:00.000Z');
  // UTC 20:59 = İstanbul aynı gün 23:59
  assert.equal(istanbulDayStart(new Date('2026-11-24T20:59:00Z')), '2026-11-23T21:00:00.000Z');
});

test('token yalnızca birebir eşleşince kabul edilir', () => {
  assert.equal(tokenMatches('gizli', 'gizli'), true);
  assert.equal(tokenMatches('gizl', 'gizli'), false);
  assert.equal(tokenMatches('', 'gizli'), false);
  assert.equal(tokenMatches(null, 'gizli'), false);
});

test('token başlıktan, yoksa adres parametresinden okunur', () => {
  const header = new Request('http://x/api/gunluk-ozet?token=b', { headers: { authorization: 'Bearer a' } });
  assert.equal(requestToken(header), 'a');
  assert.equal(requestToken(new Request('http://x/api/gunluk-ozet?token=b')), 'b');
  assert.equal(requestToken(new Request('http://x/api/gunluk-ozet')), null);
});
