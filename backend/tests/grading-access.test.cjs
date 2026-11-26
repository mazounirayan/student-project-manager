const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryRepository, installRepositories, teacher, student, rejectsWithStatus } = require('./helpers.cjs');
const { GradingService, computeTotalScore } = require('../dist/services/grading.service');

const owner = teacher(1);
const otherTeacher = teacher(2);
const alice = student(10);
const bob = student(11);

const project = { id: 1, name: 'Projet A', teacher: owner, status: 'visible' };
const grid = {
  id: 5, name: 'Rendu final', type: 'deliverable', weight: 2, project,
  criteria: [
    { id: 50, name: 'Qualité', maxScore: 10, weight: 1, hasComments: false },
    { id: 51, name: 'Tests', maxScore: 5, weight: 3, hasComments: true },
  ],
};
const aliceGroup = { id: 20, name: 'Groupe Alice', project, members: [alice] };
const bobGroup = { id: 21, name: 'Groupe Bob', project, members: [bob] };

const grade = (id, group, status, totalScore, published = status === 'validated') => ({
  id, gradingGrid: grid, group, status, totalScore, globalComments: 'Commentaire', criterionGrades: [], updatedAt: new Date(),
  validatedAt: status === 'validated' ? new Date() : null, publishedAt: published ? new Date() : null,
});

function setup() {
  const grades = memoryRepository([
    grade(1, aliceGroup, 'validated', 15),
    grade(2, aliceGroup, 'draft', 4),
    grade(3, bobGroup, 'validated', 18),
  ]);
  grades.rows[1].gradingGrid = { ...grid, id: 6, name: 'Brouillon' };
  const restore = installRepositories({
    Grade: grades,
    GradingGrid: memoryRepository([grid]),
    Group: memoryRepository([aliceGroup, bobGroup]),
    Project: memoryRepository([project]),
  });
  return { grades, restore };
}

test('un étudiant ne voit que les notes publiées de son propre groupe', async () => {
  const { restore } = setup();
  try {
    const sessions = await new GradingService().listSessions({ id: alice.id, role: 'student' }, {});
    assert.deepEqual(sessions.map(session => session.id), [1]);
    assert.equal(sessions[0].status, 'validated');
  } finally { restore(); }
});

test("un étudiant ne peut pas lire les notes d'un autre groupe en filtrant par groupId", async () => {
  const { restore } = setup();
  try {
    const sessions = await new GradingService().listSessions({ id: alice.id, role: 'student' }, { groupId: bobGroup.id });
    assert.deepEqual(sessions, []);
  } finally { restore(); }
});

test('« mes notes » exclut les brouillons et les notes des autres groupes', async () => {
  const { restore } = setup();
  try {
    const rows = await new GradingService().getStudentGrades(alice.id);
    assert.deepEqual(rows.map(row => row.id), [1]);
    assert.equal(rows[0].grade, 15);
    assert.equal(rows[0].maxGrade, 20);
  } finally { restore(); }
});

test("un enseignant ne voit que les notations de ses propres projets", async () => {
  const { restore } = setup();
  try {
    const service = new GradingService();
    assert.equal((await service.listSessions({ id: owner.id, role: 'teacher' }, {})).length, 3);
    assert.deepEqual(await service.listSessions({ id: otherTeacher.id, role: 'teacher' }, {}), []);
  } finally { restore(); }
});

test("un enseignant ne peut pas noter dans la grille d'un autre enseignant", async () => {
  const { restore } = setup();
  try {
    await rejectsWithStatus(
      new GradingService().createSession(otherTeacher.id, { gridId: grid.id, groupId: aliceGroup.id, entries: [] }),
      403,
    );
  } finally { restore(); }
});

test('la note totale est recalculée côté serveur et le dépassement de barème est refusé', async () => {
  const { grades, restore } = setup();
  try {
    const service = new GradingService();
    const session = await service.createSession(owner.id, {
      gridId: grid.id, groupId: bobGroup.id, totalScore: 20, status: 'draft',
      entries: [{ criterionId: 50, score: 10 }, { criterionId: 51, score: 0 }],
    });
    // (10/10 * 20 * 1 + 0/5 * 20 * 3) / 4 = 5
    assert.equal(session.totalScore, 5);
    assert.ok(grades.saved.length > 0);

    await rejectsWithStatus(
      service.createSession(owner.id, { gridId: grid.id, groupId: aliceGroup.id, entries: [{ criterionId: 50, score: 11 }] }),
      400,
    );
  } finally { restore(); }
});

test('computeTotalScore pondère par critère et ignore les critères non notés', () => {
  assert.equal(computeTotalScore(grid.criteria, [{ criterionId: 50, score: 5 }]), 10);
  assert.equal(computeTotalScore(grid.criteria, []), 0);
});

test("l'export CSV neutralise les formules injectées dans les noms", async () => {
  const injected = { ...aliceGroup, name: '=HYPERLINK("http://evil")', members: [alice] };
  const restore = installRepositories({
    Grade: memoryRepository([]),
    GradingGrid: memoryRepository([grid]),
    Group: memoryRepository([injected]),
    Project: memoryRepository([project]),
  });
  try {
    const csv = await new GradingService().exportProjectGrades(project.id, owner.id);
    assert.ok(csv.startsWith('﻿'));
    assert.ok(csv.includes(`"'=HYPERLINK(""http://evil"")"`));
  } finally { restore(); }
});

const complete = [{ criterionId: 50, score: 8 }, { criterionId: 51, score: 4, comment: 'Bonne couverture' }];

test('une note validée mais pas encore publiée reste invisible des étudiants', async () => {
  const unpublished = memoryRepository([grade(1, aliceGroup, 'validated', 15, false)]);
  const restore = installRepositories({ Grade: unpublished, GradingGrid: memoryRepository([grid]), Group: memoryRepository([aliceGroup]), Project: memoryRepository([project]) });
  try {
    const service = new GradingService();
    assert.deepEqual(await service.listSessions({ id: alice.id, role: 'student' }, {}), []);
    assert.deepEqual(await service.getStudentGrades(alice.id), []);
    assert.equal((await service.listSessions({ id: owner.id, role: 'teacher' }, {}))[0].publishedAt, null);
  } finally { restore(); }
});

test('publier ne touche que les notes validées, sans toucher aux brouillons', async () => {
  const rows = [grade(1, aliceGroup, 'validated', 15, false), grade(2, bobGroup, 'draft', 4), grade(3, bobGroup, 'validated', 18, true)];
  const restore = installRepositories({ Grade: memoryRepository(rows), GradingGrid: memoryRepository([grid]), Group: memoryRepository([aliceGroup, bobGroup]), Project: memoryRepository([project]) });
  try {
    const service = new GradingService();
    await rejectsWithStatus(service.publishGrades(project.id, otherTeacher.id), 403);
    assert.deepEqual(await service.publishGrades(project.id, owner.id, { groupId: bobGroup.id }), { published: 0 });
    assert.equal(rows[0].publishedAt, null);
    assert.deepEqual(await service.publishGrades(project.id, owner.id), { published: 1 });
    assert.ok(rows[0].publishedAt);
    assert.equal(rows[1].publishedAt, null);
    assert.equal(rows[1].status, 'draft');
  } finally { restore(); }
});

test('valider exige tous les critères notés et les commentaires attendus', async () => {
  const restore = installRepositories({ Grade: memoryRepository([]), GradingGrid: memoryRepository([grid]), Group: memoryRepository([aliceGroup]), Project: memoryRepository([project]) });
  try {
    const service = new GradingService();
    const base = { gridId: grid.id, groupId: aliceGroup.id, status: 'validated' };
    await rejectsWithStatus(service.createSession(owner.id, { ...base, entries: [{ criterionId: 50, score: 8 }] }), 400);
    await rejectsWithStatus(service.createSession(owner.id, { ...base, entries: [{ criterionId: 50, score: 8 }, { criterionId: 51, score: 4, comment: '  ' }] }), 400);
    const draft = await service.createSession(owner.id, { ...base, status: 'draft', entries: [{ criterionId: 50, score: 8 }] });
    assert.equal(draft.status, 'draft');
    const validated = await service.createSession(owner.id, { ...base, entries: complete });
    assert.equal(validated.status, 'validated');
    assert.equal(validated.publishedAt, null);
  } finally { restore(); }
});

test('rouvrir une note publiée la retire de la vue des étudiants', async () => {
  const published = grade(1, aliceGroup, 'validated', 15, true);
  const restore = installRepositories({ Grade: memoryRepository([published]), GradingGrid: memoryRepository([grid]), Group: memoryRepository([aliceGroup]), Project: memoryRepository([project]) });
  try {
    const service = new GradingService();
    const reopened = await service.updateSession(1, owner.id, { entries: complete, status: 'draft' });
    assert.equal(reopened.status, 'draft');
    assert.equal(reopened.publishedAt, null);
    assert.deepEqual(await service.listSessions({ id: alice.id, role: 'student' }, {}), []);
  } finally { restore(); }
});

test("l'avancement étudiant ne révèle que les notes publiées et pondère la note finale", async () => {
  const defenseGrid = { id: 6, name: 'Soutenance', type: 'defense', weight: 1, project, criteria: [] };
  const rows = [grade(1, aliceGroup, 'validated', 15, true), { ...grade(2, aliceGroup, 'validated', 4, false), gradingGrid: defenseGrid }];
  const restore = installRepositories({ Grade: memoryRepository(rows), GradingGrid: memoryRepository([grid, defenseGrid]), Group: memoryRepository([aliceGroup, bobGroup]), Project: memoryRepository([project]) });
  try {
    const [overview] = await new GradingService().getStudentOverview(alice.id);
    assert.equal(overview.projectName, 'Projet A');
    assert.equal(overview.complete, false);
    assert.equal(overview.finalGrade, 15);
    assert.deepEqual(overview.evaluations.map(item => [item.title, item.published, item.grade, Math.round(item.share * 100)]), [['Rendu final', true, 15, 67], ['Soutenance', false, null, 33]]);
    assert.deepEqual(await new GradingService().getStudentOverview(999), []);
  } finally { restore(); }
});

test('la note finale du suivi ignore les brouillons', async () => {
  const rows = [grade(1, aliceGroup, 'validated', 12), grade(2, bobGroup, 'draft', 18)];
  const restore = installRepositories({ Grade: memoryRepository(rows), GradingGrid: memoryRepository([grid]), Group: memoryRepository([aliceGroup, bobGroup]), Project: memoryRepository([project]) });
  try {
    const summary = await new GradingService().getProjectSummary(project.id, owner.id);
    const byName = Object.fromEntries(summary.groups.map(group => [group.name, group]));
    assert.equal(byName['Groupe Alice'].finalGrade, 12);
    assert.equal(byName['Groupe Alice'].grades[0].isPublished, true);
    assert.equal(byName['Groupe Bob'].finalGrade, null);
    assert.equal(byName['Groupe Bob'].grades[0].status, 'draft');
  } finally { restore(); }
});

test('modifier ou retirer un critère recalcule les notes déjà saisies', async () => {
  const local = { ...grid, criteria: grid.criteria.map(criterion => ({ ...criterion })) };
  const entries = [
    { id: 1, score: 10, criterion: local.criteria[0] },
    { id: 2, score: 0, criterion: local.criteria[1] },
  ];
  const stored = { ...grade(1, aliceGroup, 'draft', 5), gradingGrid: local, criterionGrades: entries };
  const restore = installRepositories({
    Grade: memoryRepository([stored]),
    GradingGrid: memoryRepository([local]),
    GradingCriterion: memoryRepository(local.criteria.map(criterion => Object.assign(criterion, { gradingGrid: local }))),
    Group: memoryRepository([aliceGroup]),
    Project: memoryRepository([project]),
  });
  try {
    const service = new GradingService();
    // Le critère « Tests » (coefficient 3, noté 0) passe à 1 : (20 * 1 + 0 * 1) / 2 = 10.
    await service.updateCriterion(51, owner.id, { weight: 1 });
    assert.equal(stored.totalScore, 10);
  } finally { restore(); }
});
