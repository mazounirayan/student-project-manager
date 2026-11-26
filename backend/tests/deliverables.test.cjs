const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const AdmZip = require('adm-zip');
const { validationResult } = require('express-validator');
const { memoryRepository, installRepositories, teacher, student } = require('./helpers.cjs');
const { DeliverableService } = require('../dist/services/deliverable.service');
const { ProjectService } = require('../dist/services/project.service');
const { validateDeliverable } = require('../dist/middleware/validation.middleware');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spm-deliverables-'));
test.after(() => fs.rmSync(directory, { recursive: true, force: true }));

const owner = teacher(1);
const alice = student(10);
const bob = student(11);
const carol = student(12);
const promotion = { id: 1, name: 'Promo', teacher: owner, students: [alice, bob, carol] };
const project = { id: 1, name: 'Projet', description: '', status: 'visible', teacher: owner, promotion, maxGroupSize: 3 };
const groupA = { id: 20, name: 'Groupe A', project, members: [alice] };
const groupB = { id: 21, name: 'Groupe B', project, members: [bob] };
const groupC = { id: 22, name: 'Groupe C', project, members: [carol] };

const makeZip = (name, files) => {
  const zip = new AdmZip();
  for (const [entry, content] of Object.entries(files)) zip.addFile(entry, Buffer.from(content));
  const target = path.join(directory, name);
  zip.writeZip(target);
  return target;
};

const sharedCode = Array.from({ length: 30 }, (_, i) => `const valeur${i} = calculer(${i}) + ${i};`).join('\n');
const deadline = new Date('2026-03-01T12:00:00Z');
const deliverable = {
  id: 30, name: 'Code', description: '', type: 'archive', deadline, allowLateSubmission: true, penaltyPerHour: 0.5, project, validationRules: [],
};
const stored = (id, group, filePath, extra = {}) => ({
  id, deliverable, group, filePath, fileName: path.basename(filePath ?? 'rendu.pdf'), fileSize: 10, gitUrl: null, submittedAt: new Date('2026-02-27T10:00:00Z'),
  isLate: false, penalty: 0, validationResults: [], similarityScore: null, similarityMatches: null, ...extra,
});

const install = extra => installRepositories({
  Project: memoryRepository([project]),
  Group: memoryRepository([groupA, groupB, groupC]),
  Deliverable: memoryRepository([deliverable]),
  DeliverableRule: memoryRepository([]),
  DeliverableSubmission: memoryRepository([]),
  User: memoryRepository([owner, alice, bob, carol]),
  ...extra,
});

test("l'analyse compare les rendus lisibles et laisse sans score ceux qu'elle ne peut pas lire", async () => {
  const a = stored(1, groupA, makeZip('a.zip', { 'main.js': sharedCode }));
  const b = stored(2, groupB, makeZip('b.zip', { 'main.js': `${sharedCode}\nconst extra = 1 + 1;` }));
  const c = stored(3, groupC, path.join(directory, 'rapport.pdf'));
  const restore = install({ DeliverableSubmission: memoryRepository([a, b, c]) });
  try {
    const result = await new DeliverableService().analyzeSimilarity(deliverable.id, owner.id);
    assert.equal(result.analyzed, 2);
    assert.equal(result.skipped, 1);
    assert.ok(a.similarityScore > 0.9, 'deux archives presque identiques sont rapprochées');
    assert.equal(a.similarityMatches[0].submissionId, b.id);
    assert.equal(c.similarityScore, null, 'un rendu illisible n\'a pas de score : 0 % laisserait croire qu\'il a été vérifié');
    assert.equal(c.similarityMatches, null);
  } finally { restore(); }
});

test("la ressemblance n'est visible que de l'enseignant, avec le nom des groupes rapprochés", async () => {
  const a = stored(1, groupA, '/srv/a.zip', { similarityScore: 0.8, similarityMatches: [{ submissionId: 2, finalScore: 0.8, textScore: 0.8, details: '80 lignes identiques sur 100.' }] });
  const b = stored(2, groupB, '/srv/b.zip', { similarityScore: 0.8, similarityMatches: [{ submissionId: 1, finalScore: 0.8, textScore: 0.8, details: '80 lignes identiques sur 100.' }] });
  const withRelations = {
    ...project, groups: [groupA, groupB], reports: [], defenses: [], gradingGrids: [],
    deliverables: [{ ...deliverable, submissions: [a, b] }],
  };
  const restore = install({ Project: memoryRepository([withRelations]) });
  try {
    const asStudent = await new ProjectService().getProjectDetail(project.id, { id: alice.id, role: 'student' });
    const [own] = asStudent.deliverables[0].submissions;
    assert.equal(asStudent.deliverables[0].submissions.length, 1);
    assert.equal('similarityScore' in own, false);
    assert.equal('similarTo' in own, false);

    const asTeacher = await new ProjectService().getProjectDetail(project.id, { id: owner.id, role: 'teacher' });
    const first = asTeacher.deliverables[0].submissions.find(item => item.id === 1);
    assert.equal(first.similarityScore, 0.8);
    assert.deepEqual(first.similarTo.map(item => [item.groupName, item.score]), [['Groupe B', 0.8]]);
    assert.equal(JSON.stringify(asTeacher).includes('/srv/'), false, 'aucun chemin serveur ne doit fuiter');
  } finally { restore(); }
});

test('remplacer un rendu garde une seule soumission, efface son analyse et calcule une pénalité décimale', async () => {
  const late = { ...deliverable, deadline: new Date(Date.now() - 90 * 60_000), project, validationRules: [] };
  const previous = stored(7, groupA, path.join(directory, 'ancien.zip'), { similarityScore: 0.9, similarityMatches: [{ submissionId: 2, finalScore: 0.9, textScore: 0.9, details: '' }] });
  const submissions = memoryRepository([previous]);
  const restore = install({
    Deliverable: memoryRepository([late]),
    Group: memoryRepository([groupA]),
    DeliverableSubmission: submissions,
  });
  try {
    const file = { path: path.join(directory, 'nouveau.zip'), originalname: 'nouveau.zip', size: 2048 };
    const result = await new DeliverableService().submit(late.id, { id: alice.id, role: 'student' }, { groupId: groupA.id, file });
    assert.equal(submissions.rows.length, 1, 'le rendu précédent est remplacé, pas dupliqué');
    assert.equal(result.id, previous.id);
    assert.equal(previous.fileName, 'nouveau.zip');
    assert.equal(previous.similarityScore, null);
    assert.equal(previous.similarityMatches, null);
    assert.equal(previous.isLate, true);
    assert.equal(previous.penalty, 1, '2 h entamées à 0,5 point par heure');
    assert.equal('similarityScore' in result, false, 'l\'étudiant ne reçoit pas d\'indice de ressemblance');
  } finally { restore(); }
});

test('la pénalité par heure accepte les décimales mais pas les valeurs négatives', async () => {
  const run = async penaltyPerHour => {
    const req = { body: { name: 'Livrable', description: '', type: 'archive', deadline: '2026-03-01T12:00:00Z', projectId: 1, penaltyPerHour } };
    for (const middleware of validateDeliverable(false)) await new Promise(resolve => {
      const next = () => resolve();
      const result = middleware(req, { status: () => ({ json: () => resolve() }) }, next);
      if (result?.then) result.then(resolve);
    });
    return validationResult(req).isEmpty();
  };
  assert.equal(await run(0.5), true);
  assert.equal(await run(-1), false);
});
