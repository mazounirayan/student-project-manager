const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryRepository, installRepositories, teacher, student, rejectsWithStatus } = require('./helpers.cjs');
const { DefenseService } = require('../dist/services/defense.service');
const { serializeDefense } = require('../dist/serializers');

const owner = teacher(1);
const other = teacher(2);
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

const project = { id: 1, name: 'Projet', teacher: owner };
const makeGroup = (id, members = [student(id * 10)]) => ({ id, name: `Groupe ${id}`, project, members });
const slot = (id, group, start, minutes = 30, extra = {}) => ({
  id, project, group, startTime: new Date(start), endTime: new Date(start + minutes * MINUTE), orderIndex: id, location: 'Salle A', instructions: null, ...extra,
});

function install(groups, defenses = []) {
  const defenseRepository = memoryRepository(defenses);
  defenseRepository.remove = async value => {
    (Array.isArray(value) ? value : [value]).forEach(item => { const index = defenses.indexOf(item); if (index >= 0) defenses.splice(index, 1); });
    return value;
  };
  const restore = installRepositories({ Project: memoryRepository([project]), Group: memoryRepository(groups), Defense: defenseRepository });
  return { restore, defenses };
}

const service = new DefenseService();
const tomorrow = Date.now() + 24 * HOUR;
const summary = list => list.map(item => [item.group.name, item.orderIndex, new Date(item.startTime).getTime()]);

test("planifier : un créneau par groupe, avec la durée et la pause choisies", async () => {
  const groups = [makeGroup(2), makeGroup(1), makeGroup(3)];
  const { restore } = install(groups);
  try {
    const { defenses } = await service.schedule(1, owner.id, {
      startDateTime: new Date(tomorrow).toISOString(), durationPerGroup: 20, breakMinutes: 10, location: 'Amphi B', instructions: '  Apportez votre ordinateur.  ',
    });
    assert.deepEqual(summary(defenses), [
      ['Groupe 1', 1, tomorrow], ['Groupe 2', 2, tomorrow + 30 * MINUTE], ['Groupe 3', 3, tomorrow + 60 * MINUTE],
    ]);
    assert.equal(new Date(defenses[0].endTime).getTime(), tomorrow + 20 * MINUTE);
    assert.equal(defenses[0].location, 'Amphi B');
    assert.equal(defenses[1].instructions, 'Apportez votre ordinateur.');
  } finally { restore(); }
});

test("planifier : la pause par défaut est de 5 minutes et un groupe sans membre n'a pas de créneau", async () => {
  const { restore } = install([makeGroup(1), makeGroup(2, []), makeGroup(3)]);
  try {
    const { defenses } = await service.schedule(1, owner.id, { startDateTime: new Date(tomorrow).toISOString(), durationPerGroup: 30 });
    assert.deepEqual(summary(defenses), [['Groupe 1', 1, tomorrow], ['Groupe 3', 2, tomorrow + 35 * MINUTE]]);
  } finally { restore(); }
});

test("planifier de nouveau : l'ordre actuel est gardé, les nouveaux groupes passent à la fin, les consignes aussi", async () => {
  const groups = [makeGroup(1), makeGroup(2), makeGroup(3), makeGroup(4)];
  const existing = [slot(1, groups[2], tomorrow, 30, { instructions: 'Apportez la démo.' }), slot(2, groups[0], tomorrow + 35 * MINUTE), slot(3, groups[1], tomorrow + 70 * MINUTE)];
  const { restore } = install(groups, existing);
  try {
    const { defenses } = await service.schedule(1, owner.id, { startDateTime: new Date(tomorrow + 2 * HOUR).toISOString(), durationPerGroup: 15, breakMinutes: 0 });
    assert.deepEqual(summary(defenses).map(([name, order]) => [name, order]), [['Groupe 3', 1], ['Groupe 1', 2], ['Groupe 2', 3], ['Groupe 4', 4]]);
    assert.equal(new Date(defenses[3].startTime).getTime(), tomorrow + 2 * HOUR + 45 * MINUTE);
    assert.ok(defenses.every(item => item.instructions === 'Apportez la démo.'));
  } finally { restore(); }
});

test("planifier de nouveau : une soutenance déjà passée est conservée telle quelle", async () => {
  const groups = [makeGroup(1), makeGroup(2), makeGroup(3)];
  const past = Date.now() - 3 * HOUR;
  const existing = [slot(1, groups[1], past), slot(2, groups[0], tomorrow), slot(3, groups[2], tomorrow + 35 * MINUTE)];
  const { restore } = install(groups, existing);
  try {
    const { defenses } = await service.schedule(1, owner.id, { startDateTime: new Date(tomorrow + HOUR).toISOString(), durationPerGroup: 30, breakMinutes: 5 });
    assert.deepEqual(summary(defenses), [['Groupe 2', 1, past], ['Groupe 1', 2, tomorrow + HOUR], ['Groupe 3', 3, tomorrow + HOUR + 35 * MINUTE]]);
  } finally { restore(); }
});

test("planifier : refuse sans groupe ou quand tout est passé, et réserve l'action à l'enseignant du projet", async () => {
  const groups = [makeGroup(1)];
  const { restore } = install(groups, [slot(1, groups[0], Date.now() - 5 * HOUR)]);
  try {
    await rejectsWithStatus(service.schedule(1, owner.id, { startDateTime: new Date(tomorrow).toISOString() }), 400);
    await rejectsWithStatus(service.schedule(1, other.id, { startDateTime: new Date(tomorrow).toISOString() }), 403);
    await rejectsWithStatus(service.schedule(1, owner.id, { startDateTime: 'pas une date' }), 400);
  } finally { restore(); }
  const empty = install([makeGroup(1, [])]);
  try {
    await rejectsWithStatus(service.schedule(1, owner.id, { startDateTime: new Date(tomorrow).toISOString() }), 400);
  } finally { empty.restore(); }
});

test("réordonner : chaque groupe prend l'horaire de sa nouvelle place", async () => {
  const groups = [makeGroup(1), makeGroup(2), makeGroup(3)];
  const existing = [slot(1, groups[0], tomorrow), slot(2, groups[1], tomorrow + 40 * MINUTE), slot(3, groups[2], tomorrow + 80 * MINUTE)];
  const { restore } = install(groups, existing);
  try {
    const { defenses } = await service.reorder(1, owner.id, [{ groupId: 3, orderIndex: 1 }, { groupId: 1, orderIndex: 2 }, { groupId: 2, orderIndex: 3 }]);
    assert.deepEqual(summary(defenses), [['Groupe 3', 1, tomorrow], ['Groupe 1', 2, tomorrow + 40 * MINUTE], ['Groupe 2', 3, tomorrow + 80 * MINUTE]]);
    await rejectsWithStatus(service.reorder(1, other.id, [{ groupId: 1, orderIndex: 1 }]), 403);
  } finally { restore(); }
});

test("réordonner : une soutenance déjà passée ne bouge pas et personne ne prend sa place", async () => {
  const groups = [makeGroup(1), makeGroup(2), makeGroup(3)];
  const existing = [slot(1, groups[0], Date.now() - 3 * HOUR), slot(2, groups[1], tomorrow), slot(3, groups[2], tomorrow + 40 * MINUTE)];
  const { restore } = install(groups, existing);
  try {
    await rejectsWithStatus(service.reorder(1, owner.id, [{ groupId: 2, orderIndex: 1 }, { groupId: 1, orderIndex: 2 }, { groupId: 3, orderIndex: 3 }]), 400);
    const { defenses } = await service.reorder(1, owner.id, [{ groupId: 1, orderIndex: 1 }, { groupId: 3, orderIndex: 2 }, { groupId: 2, orderIndex: 3 }]);
    assert.deepEqual(defenses.map(item => item.group.name), ['Groupe 1', 'Groupe 3', 'Groupe 2']);
    assert.equal(new Date(defenses[1].startTime).getTime(), tomorrow);
  } finally { restore(); }
});

test("réordonner : sans planning, la demande est refusée ; la sérialisation expose les consignes", async () => {
  const { restore } = install([makeGroup(1)]);
  try {
    await rejectsWithStatus(service.reorder(1, owner.id, [{ groupId: 1, orderIndex: 1 }]), 400);
  } finally { restore(); }
  const serialized = serializeDefense(slot(1, makeGroup(1), tomorrow, 30, { instructions: 'Dix minutes de démonstration.' }));
  assert.equal(serialized.instructions, 'Dix minutes de démonstration.');
  assert.equal(serializeDefense(slot(2, makeGroup(1), tomorrow)).instructions, null);
});
