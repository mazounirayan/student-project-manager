const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryRepository, installRepositories, teacher, student, rejectsWithStatus } = require('./helpers.cjs');
const { GradingService, computeTotalScore } = require('../dist/services/grading.service');

const owner = teacher(1);
const otherTeacher = teacher(2);
const alice = student(10);
const bob = student(11);

const project = { id: 1, name: 'Projet A', teacher: owner };
const grid = {
  id: 5, name: 'Rendu final', type: 'deliverable', weight: 2, project,
  criteria: [
    { id: 50, name: 'Qualité', maxScore: 10, weight: 1 },
    { id: 51, name: 'Tests', maxScore: 5, weight: 3 },
  ],
};
const aliceGroup = { id: 20, name: 'Groupe Alice', project, members: [alice] };
const bobGroup = { id: 21, name: 'Groupe Bob', project, members: [bob] };

const grade = (id, group, status, totalScore) => ({
  id, gradingGrid: grid, group, status, totalScore, globalComments: 'Commentaire', criterionGrades: [], updatedAt: new Date(), validatedAt: new Date(),
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

test('un étudiant ne voit que les notes validées de son propre groupe', async () => {
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
