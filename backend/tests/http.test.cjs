const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryRepository, installRepositories, teacher, student } = require('./helpers.cjs');

process.env.JWT_SECRET = 'a'.repeat(48);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(48);

const jwt = require('jsonwebtoken');
const app = require('../dist/app').default;

const teacherAccount = teacher(1);
const studentAccount = student(10);
const tokenFor = user => jwt.sign({ id: user.id }, process.env.JWT_SECRET);

async function withServer(run) {
  const restore = installRepositories({
    User: memoryRepository([teacherAccount, studentAccount, { ...student(11), isActive: false }]),
    Grade: memoryRepository([]),
  });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try { await run(base); } finally { server.close(); restore(); }
}

const call = (base, path, { token, ...options } = {}) =>
  fetch(`${base}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) } });

test('les routes protégées exigent un jeton valide', async () => {
  await withServer(async base => {
    assert.equal((await call(base, '/grading/sessions')).status, 401);
    assert.equal((await call(base, '/grading/sessions', { token: 'invalide' })).status, 401);
    assert.equal((await call(base, '/grading/sessions', { token: tokenFor(student(11)) })).status, 401, 'compte désactivé');
    assert.equal((await call(base, '/grading/sessions', { token: tokenFor(studentAccount) })).status, 200);
  });
});

test('les routes enseignant renvoient 403 à un étudiant', async () => {
  await withServer(async base => {
    const token = tokenFor(studentAccount);
    for (const [method, path] of [
      ['POST', '/grading/sessions'], ['GET', '/grading/projects/1/summary'], ['POST', '/grading/grades/validate'],
      ['PUT', '/projects/1/groups'], ['POST', '/deliverables'], ['GET', '/deliverables/1/submissions'],
      ['GET', '/reports/projects/1'], ['POST', '/defenses/projects/1/schedule'], ['GET', '/submissions/1/similarity'],
      ['GET', '/promotions/my'], ['GET', '/users/students'],
    ]) {
      const response = await call(base, path, { method, token, body: method === 'GET' ? undefined : '{}' });
      assert.equal(response.status, 403, `${method} ${path}`);
    }
  });
});

test('les routes étudiant renvoient 403 à un enseignant', async () => {
  await withServer(async base => {
    const token = tokenFor(teacherAccount);
    for (const [method, path] of [
      ['GET', '/grading/students/my-grades'], ['POST', '/groups/1/join'], ['POST', '/deliverables/1/submit'], ['POST', '/deliverables/1/validate'],
    ]) {
      assert.equal((await call(base, path, { method, token, body: method === 'GET' ? undefined : '{}' })).status, 403, `${method} ${path}`);
    }
  });
});

test('un identifiant invalide ou un corps mal formé donnent une erreur 400 en français', async () => {
  await withServer(async base => {
    const token = tokenFor(teacherAccount);
    const badId = await call(base, '/projects/abc', { token });
    assert.equal(badId.status, 400);
    assert.deepEqual(await badId.json(), { error: 'Identifiant invalide' });

    const badSession = await call(base, '/grading/sessions', { method: 'POST', token, body: JSON.stringify({ entries: [{ criterionId: 1, score: -3 }] }) });
    assert.equal(badSession.status, 400);

    const malformed = await call(base, '/grading/sessions', { method: 'POST', token, body: '{pas du json' });
    assert.equal(malformed.status, 400);
  });
});

test('une route inconnue renvoie 404 sans détail technique', async () => {
  await withServer(async base => {
    const response = await call(base, '/inconnue');
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: 'Route introuvable' });
  });
});
