const test = require('node:test');
const assert = require('node:assert/strict');
const { parseRouteId } = require('../dist/utils/route-id');
const { jwtSecret } = require('../dist/config/secrets');

test('resource IDs reject ambiguous, truncated and unsafe values', () => {
  assert.equal(parseRouteId('42'), 42);
  for (const value of [undefined, ['42'], '0', '-1', '1abc', '1.2', '9007199254740992']) {
    assert.throws(() => parseRouteId(value), { message: 'Invalid resource ID', status: 400 });
  }
});

test('JWT secrets reject missing and short configuration', () => {
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

test('public registration cannot request a teacher role', async () => {
  const { AppDataSource } = require('../dist/database/data-source');
  const { AuthService } = require('../dist/services/auth.service');
  const original = AppDataSource.getRepository;
  const previousAccess = process.env.JWT_SECRET;
  const previousRefresh = process.env.JWT_REFRESH_SECRET;
  process.env.JWT_SECRET = 'a'.repeat(48);
  process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);
  AppDataSource.getRepository = () => ({
    findOne: async () => null,
    create: value => value,
    save: async value => ({ ...value, id: 1 }),
  });
  try {
    const result = await new AuthService().registerStudent({
      email: 'student@example.com', password: 'ExamplePassword123',
      firstName: 'Example', lastName: 'Student', role: 'teacher',
    });
    assert.equal(result.user.role, 'student');
    assert.equal('password' in result.user, false);
    assert.ok(result.token && result.refreshToken);
  } finally {
    AppDataSource.getRepository = original;
    for (const [key, value] of [['JWT_SECRET', previousAccess], ['JWT_REFRESH_SECRET', previousRefresh]]) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('profile updates cannot mutate role or password', async () => {
  const { UserController } = require('../dist/controllers/user.controller');
  const controller = new UserController();
  let updated;
  controller.userService = { updateUser: async (id, value) => { updated = { id, ...value }; return updated; } };
  const response = { json: () => {}, status() { return this; } };
  await controller.updateProfile({ user: { id: 7 }, body: { firstName: 'Example', role: 'teacher', password: 'override' } }, response);
  assert.deepEqual(updated, { id: 7, firstName: 'Example' });
});

test('serialized users exclude authentication secrets', () => {
  const { User } = require('../dist/entities/Entities');
  const user = Object.assign(new User(), { id: 1, firstName: 'Example', password: 'hash', resetToken: 'secret', resetTokenExpiry: new Date() });
  assert.deepEqual(JSON.parse(JSON.stringify(user)), { id: 1, firstName: 'Example' });
});
