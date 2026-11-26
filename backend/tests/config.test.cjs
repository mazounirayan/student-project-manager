const test = require('node:test');
const assert = require('node:assert/strict');
const { parseId } = require('../dist/utils/route-id');
const { jwtSecret } = require('../dist/config/secrets');
const { User } = require('../dist/entities/Entities');

test('les identifiants refusent les valeurs ambiguës, tronquées ou dangereuses', () => {
  assert.equal(parseId('42'), 42);
  assert.equal(parseId(42), 42);
  for (const value of [undefined, ['42'], '0', '-1', '1abc', '1.2', '9007199254740992', 1.5, null, {}]) {
    assert.throws(() => parseId(value), { message: 'Identifiant invalide', status: 400 });
  }
});

test('les secrets JWT refusent une configuration absente ou trop courte', () => {
  const previous = process.env.JWT_SECRET;
  try {
    delete process.env.JWT_SECRET;
    assert.throws(() => jwtSecret('JWT_SECRET'));
    process.env.JWT_SECRET = 'short';
    assert.throws(() => jwtSecret('JWT_SECRET'));
    process.env.JWT_SECRET = 'a'.repeat(48);
    assert.equal(jwtSecret('JWT_SECRET'), 'a'.repeat(48));
  } finally {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  }
});

test("la sérialisation d'un utilisateur exclut les secrets d'authentification", () => {
  const user = Object.assign(new User(), {
    id: 1, firstName: 'Example', password: 'hash', resetToken: 'secret', resetTokenExpiry: new Date(),
    googleId: 'g-1', microsoftId: 'm-1',
  });
  assert.deepEqual(JSON.parse(JSON.stringify(user)), { id: 1, firstName: 'Example' });
});
