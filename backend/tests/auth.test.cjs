const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryRepository, installRepositories, rejectsWithStatus } = require('./helpers.cjs');

process.env.JWT_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);

const jwt = require('jsonwebtoken');
const { AuthService } = require('../dist/services/auth.service');
const { PasswordService } = require('../dist/utils/password.service');

test("l'inscription publique ne permet jamais de choisir le rôle enseignant", async () => {
  const users = memoryRepository([]);
  const restore = installRepositories({ User: users });
  try {
    const result = await new AuthService().registerStudent({
      email: 'Student@Example.com', password: 'ExamplePassword123', firstName: 'Example', lastName: 'Student', role: 'teacher',
    });
    assert.equal(result.user.role, 'student');
    assert.equal(result.user.email, 'student@example.com');
    assert.equal('password' in result.user, false);
    assert.ok(result.token && result.refreshToken);
    assert.notEqual(users.saved[0].password, 'ExamplePassword123');
  } finally { restore(); }
});

test("l'inscription refuse une adresse déjà utilisée", async () => {
  const restore = installRepositories({ User: memoryRepository([{ id: 1, email: 'student@example.com' }]) });
  try {
    await rejectsWithStatus(new AuthService().registerStudent({
      email: 'student@example.com', password: 'ExamplePassword123', firstName: 'A', lastName: 'B',
    }), 409);
  } finally { restore(); }
});

test("un jeton d'accès ne peut pas servir de jeton de rafraîchissement", async () => {
  const accessToken = jwt.sign({ id: 1, role: 'teacher' }, process.env.JWT_SECRET);
  const refreshWithoutType = jwt.sign({ id: 1 }, process.env.JWT_REFRESH_SECRET);
  const restore = installRepositories({ User: memoryRepository([{ id: 1, isActive: true, role: 'student', email: 'a@example.com' }]) });
  try {
    const service = new AuthService();
    await rejectsWithStatus(service.refreshAccessToken(accessToken), 401);
    await rejectsWithStatus(service.refreshAccessToken(refreshWithoutType), 401);
    const valid = jwt.sign({ id: 1, type: 'refresh' }, process.env.JWT_REFRESH_SECRET);
    assert.ok((await service.refreshAccessToken(valid)).token);
  } finally { restore(); }
});

test('le jeton de réinitialisation est stocké haché et à usage unique', async () => {
  const user = { id: 1, email: 'student@example.com', firstName: 'Example', isActive: true };
  const updates = [];
  const users = memoryRepository([user]);
  users.update = async (id, values) => { updates.push(values); Object.assign(user, values); };
  const restore = installRepositories({ User: users });
  try {
    const service = new AuthService();
    let emailedToken;
    service.emailService = { sendPasswordResetEmail: async (_email, _name, token) => { emailedToken = token; } };

    await service.requestPasswordReset('student@example.com');
    assert.ok(emailedToken);
    assert.notEqual(updates[0].resetToken, emailedToken);
    assert.equal(updates[0].resetToken, PasswordService.hashToken(emailedToken));

    await rejectsWithStatus(service.resetPassword('jeton-inconnu', 'NewPassword123'), 400);
    await service.resetPassword(emailedToken, 'NewPassword123');
    assert.equal(user.resetToken, null);
    await rejectsWithStatus(service.resetPassword(emailedToken, 'NewPassword123'), 400);
  } finally { restore(); }
});
