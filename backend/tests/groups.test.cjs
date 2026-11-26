const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryRepository, installRepositories, teacher, student, rejectsWithStatus } = require('./helpers.cjs');
const { GroupService } = require('../dist/services/group.service');

const owner = teacher(1);
const other = teacher(2);
const alice = student(10);
const bob = student(11);
const carol = student(12);
const outsider = student(13);

const tomorrow = new Date(Date.now() + 86_400_000);
const yesterday = new Date(Date.now() - 86_400_000);

const makeProject = (extra = {}) => {
  const promotion = { id: 1, name: 'Promo', teacher: owner, students: [alice, bob, carol] };
  return {
    id: 1, name: 'Projet', description: 'Description', status: 'visible', teacher: owner, promotion, promotionId: 1,
    maxGroupSize: 2, groupFormationRule: 'free', groupFormationDeadline: tomorrow, groups: [], ...extra,
  };
};

function install(project, groups) {
  project.groups = groups;
  const groupRepository = memoryRepository(groups);
  groupRepository.remove = async value => { groups.splice(groups.indexOf(value), 1); return value; };
  const restore = installRepositories({
    Project: memoryRepository([project]),
    Group: groupRepository,
    User: memoryRepository([owner, other, alice, bob, carol, outsider]),
  });
  return { restore, groupRepository };
}

const asStudent = user => ({ id: user.id, role: 'student' });
const asTeacher = user => ({ id: user.id, role: 'teacher' });

test("l'enseignant crée un groupe vide, numéroté après le plus grand numéro existant", async () => {
  const project = makeProject();
  const groups = [{ id: 20, name: 'Groupe 1', project, members: [] }, { id: 21, name: 'Groupe 4', project, members: [] }];
  const { restore } = install(project, groups);
  try {
    const created = await new GroupService().createGroup(project.id, asTeacher(owner));
    assert.equal(created.name, 'Groupe 5');
    assert.deepEqual(created.members, []);
    await rejectsWithStatus(new GroupService().createGroup(project.id, asTeacher(other)), 403);
  } finally { restore(); }
});

test("un étudiant crée un groupe seulement en formation libre, avant la date limite et sans groupe", async () => {
  const project = makeProject();
  const { restore } = install(project, []);
  try {
    const created = await new GroupService().createGroup(project.id, asStudent(alice));
    assert.deepEqual(created.members.map(member => member.id), [alice.id]);
    await rejectsWithStatus(new GroupService().createGroup(project.id, asStudent(alice)), 409);
    await rejectsWithStatus(new GroupService().createGroup(project.id, asStudent(outsider)), 404);
  } finally { restore(); }

  for (const extra of [{ groupFormationRule: 'manual' }, { groupFormationDeadline: yesterday }]) {
    const closed = makeProject(extra);
    const { restore: restoreClosed } = install(closed, []);
    try {
      await rejectsWithStatus(new GroupService().createGroup(closed.id, asStudent(alice)), 403);
    } finally { restoreClosed(); }
  }
});

test('un étudiant quitte son groupe tant que la formation libre est ouverte', async () => {
  const project = makeProject();
  const group = { id: 20, name: 'Groupe 1', project, members: [alice, bob] };
  const { restore } = install(project, [group]);
  try {
    await rejectsWithStatus(new GroupService().leaveGroup(group.id, carol.id), 404);
    const left = await new GroupService().leaveGroup(group.id, alice.id);
    assert.deepEqual(left.members.map(member => member.id), [bob.id]);
    assert.deepEqual(group.members.map(member => member.id), [bob.id]);
  } finally { restore(); }
});

test("quitter un groupe est refusé quand l'enseignant constitue les groupes ou que la date limite est passée", async () => {
  for (const extra of [{ groupFormationRule: 'manual' }, { groupFormationDeadline: yesterday }]) {
    const project = makeProject(extra);
    const group = { id: 20, name: 'Groupe 1', project, members: [alice] };
    const { restore } = install(project, [group]);
    try {
      await rejectsWithStatus(new GroupService().leaveGroup(group.id, alice.id), 403);
      assert.deepEqual(group.members.map(member => member.id), [alice.id]);
    } finally { restore(); }
  }
});

test("rejoindre un groupe complet ou quand on en a déjà un est refusé", async () => {
  const project = makeProject();
  const full = { id: 20, name: 'Groupe 1', project, members: [alice, bob] };
  const open = { id: 21, name: 'Groupe 2', project, members: [carol] };
  const { restore } = install(project, [full, open]);
  try {
    await rejectsWithStatus(new GroupService().joinGroup(full.id, carol.id), 403);
    await rejectsWithStatus(new GroupService().joinGroup(open.id, alice.id), 409);
  } finally { restore(); }
});

test("seul un groupe vide, sans rendu ni rapport, peut être supprimé par l'enseignant du projet", async () => {
  const project = makeProject();
  const withMember = { id: 20, name: 'Groupe 1', project, members: [alice], deliverableSubmissions: [], reports: [] };
  const withWork = { id: 21, name: 'Groupe 2', project, members: [], deliverableSubmissions: [{ id: 1 }], reports: [] };
  const empty = { id: 22, name: 'Groupe 3', project, members: [], deliverableSubmissions: [], reports: [] };
  const groups = [withMember, withWork, empty];
  const { restore } = install(project, groups);
  try {
    const service = new GroupService();
    await rejectsWithStatus(service.deleteGroup(withMember.id, owner.id), 409);
    await rejectsWithStatus(service.deleteGroup(withWork.id, owner.id), 409);
    await rejectsWithStatus(service.deleteGroup(empty.id, other.id), 403);
    await rejectsWithStatus(service.deleteGroup(999, owner.id), 404);
    await service.deleteGroup(empty.id, owner.id);
    assert.deepEqual(groups.map(group => group.id), [withMember.id, withWork.id]);
  } finally { restore(); }
});
