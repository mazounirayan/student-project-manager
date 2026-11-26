const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryRepository, installRepositories, teacher, student, rejectsWithStatus } = require('./helpers.cjs');
const { PromotionService } = require('../dist/services/promotion.service');
const { UserService } = require('../dist/services/user.service');

const owner = teacher(1);
const other = teacher(2);
const alice = student(10);
const bob = student(11);

const makePromotion = (extra = {}) => ({ id: 1, name: 'Promo', year: 2026, teacher: owner, students: [alice, bob], projects: [], ...extra });

function install(promotion, users = [owner, other, alice, bob], groups = []) {
  const promotions = memoryRepository([promotion]);
  const groupRepository = memoryRepository(groups);
  const removed = [];
  promotions.remove = async value => { removed.push(value); return value; };
  const restore = installRepositories({ Promotion: promotions, User: memoryRepository(users), Group: groupRepository });
  return { restore, removed, promotions, groupRepository };
}

function promotionService() {
  const service = new PromotionService();
  service.emailService = { sendAccountCreationEmail: async () => undefined };
  return service;
}

test('une promotion qui contient des projets ne peut pas être supprimée', async () => {
  const { restore, removed } = install(makePromotion({ projects: [{ id: 5 }] }));
  try {
    await rejectsWithStatus(promotionService().deletePromotion(1, owner.id), 409);
    assert.equal(removed.length, 0);
  } finally { restore(); }
});

test("une promotion vide est supprimée par son enseignant, pas par un autre", async () => {
  const { restore, removed } = install(makePromotion());
  try {
    await rejectsWithStatus(promotionService().deletePromotion(1, other.id), 403);
    await rejectsWithStatus(promotionService().deletePromotion(99, owner.id), 404);
    await promotionService().deletePromotion(1, owner.id);
    assert.equal(removed.length, 1);
  } finally { restore(); }
});

test("l'ajout d'étudiants explique chaque ligne refusée et compte comptes créés et existants", async () => {
  const promotion = makePromotion({ students: [alice] });
  const { restore } = install(promotion);
  try {
    const { summary } = await promotionService().addStudents(1, owner.id, [
      { email: 'Nouveau@Example.org', firstName: 'Nina', lastName: 'Durand' },
      { email: bob.email },
      { email: 'nouveau@example.org' },
      { email: 'pas-une-adresse' },
      { firstName: 'Sans', lastName: 'Email' },
      { email: owner.email },
    ]);
    assert.equal(summary.totalProcessed, 6);
    assert.equal(summary.newStudents, 1);
    assert.equal(summary.existingStudents, 1);
    assert.deepEqual(summary.errors, [
      'Ligne 3 : adresse en double (nouveau@example.org)',
      'Ligne 4 : adresse email manquante ou invalide',
      'Ligne 5 : adresse email manquante ou invalide',
      `Ligne 6 : ${owner.email} est un compte enseignant`,
    ]);
    assert.deepEqual(promotion.students.map(member => member.email), [alice.email, 'nouveau@example.org', bob.email]);
  } finally { restore(); }
});

test("l'ajout d'étudiants refuse plus de 500 lignes et les promotions d'un autre enseignant", async () => {
  const { restore } = install(makePromotion());
  try {
    await rejectsWithStatus(promotionService().addStudents(1, owner.id, Array.from({ length: 501 }, (_, i) => ({ email: `e${i}@example.org` }))), 400);
    await rejectsWithStatus(promotionService().addStudents(1, other.id, [{ email: 'a@example.org' }]), 403);
  } finally { restore(); }
});

test("retirer un étudiant d'une promotion conserve son compte", async () => {
  const promotion = makePromotion();
  const { restore } = install(promotion);
  try {
    await rejectsWithStatus(promotionService().removeStudent(1, other.id, alice.id), 403);
    await promotionService().removeStudent(1, owner.id, alice.id);
    assert.deepEqual(promotion.students.map(member => member.id), [bob.id]);
  } finally { restore(); }
});

test("retirer un étudiant d'une promotion le retire aussi des groupes de ses projets, sans toucher aux autres groupes", async () => {
  const promotion = makePromotion();
  const otherPromotion = { id: 2, name: 'Autre promo', teacher: owner, students: [alice] };
  const project = { id: 7, promotion };
  const alone = { id: 30, name: 'Groupe 1', project, members: [alice, bob] };
  const withoutAlice = { id: 31, name: 'Groupe 2', project, members: [bob] };
  const elsewhere = { id: 32, name: 'Groupe 1', project: { id: 8, promotion: otherPromotion }, members: [alice] };
  const { restore, groupRepository } = install(promotion, undefined, [alone, withoutAlice, elsewhere]);
  try {
    await promotionService().removeStudent(1, owner.id, alice.id);
    assert.deepEqual(alone.members.map(member => member.id), [bob.id]);
    assert.deepEqual(withoutAlice.members.map(member => member.id), [bob.id]);
    assert.deepEqual(elsewhere.members.map(member => member.id), [alice.id]);
    assert.deepEqual(groupRepository.saved.map(group => group.id), [alone.id]);
  } finally { restore(); }
});

test('la liste des comptes inclut les comptes désactivés et un compte étudiant se réactive', async () => {
  const inactive = { ...student(12), isActive: false };
  const restore = installRepositories({ User: memoryRepository([owner, alice, inactive]) });
  try {
    const service = new UserService();
    const students = await service.listByRole('student');
    assert.deepEqual(students.map(user => user.id), [alice.id, inactive.id]);

    const reactivated = await service.reactivateStudent(inactive.id);
    assert.equal(reactivated.isActive, true);
    await rejectsWithStatus(service.reactivateStudent(owner.id), 403);
    await rejectsWithStatus(service.deactivateStudent(999), 404);
  } finally { restore(); }
});
