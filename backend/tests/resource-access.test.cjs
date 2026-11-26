const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryRepository, installRepositories, teacher, student, rejectsWithStatus } = require('./helpers.cjs');
const { ProjectService } = require('../dist/services/project.service');
const { ReportService } = require('../dist/services/report.service');
const { DeliverableService } = require('../dist/services/deliverable.service');
const { GroupService } = require('../dist/services/group.service');
const { UserService } = require('../dist/services/user.service');

const owner = teacher(1);
const alice = student(10);
const bob = student(11);
const outsider = student(12);

const promotion = { id: 1, name: 'Promo', teacher: owner, students: [alice, bob] };
const project = {
  id: 1, name: 'Projet', description: 'Description', status: 'visible', teacher: owner, promotion, promotionId: 1,
  maxGroupSize: 3, groupFormationRule: 'free',
};
const aliceGroup = { id: 20, name: 'Groupe A', project, members: [alice] };
const bobGroup = { id: 21, name: 'Groupe B', project, members: [bob] };

const deliverable = {
  id: 30, name: 'Rendu', description: '', type: 'archive', deadline: new Date(Date.now() + 86_400_000),
  allowLateSubmission: false, penaltyPerHour: 0, project, validationRules: [],
};
const submission = (id, group, filePath) => ({
  id, deliverable, group, filePath, fileName: 'rendu.zip', fileSize: 10, submittedAt: new Date(), isLate: false, penalty: 0, validationResults: [],
});
const submissions = [submission(40, aliceGroup, '/srv/secret/alice.zip'), submission(41, bobGroup, '/srv/secret/bob.zip')];

const sectionConfig = { id: 70, title: 'Introduction', required: true, orderIndex: 1 };
const reportConfig = { id: 60, project, isEnabled: true, format: 'markdown', deadline: null, sections: [sectionConfig] };
sectionConfig.config = reportConfig;
const makeReport = (id, group, status = 'draft', content = '') => ({
  id, title: `Rapport ${id}`, project, group, status, submittedAt: null,
  sections: content ? [{ id: id * 10, content, updatedAt: new Date(), sectionConfig }] : [],
});

function install(extra = {}) {
  return installRepositories({
    Project: memoryRepository([project]),
    Group: memoryRepository([aliceGroup, bobGroup]),
    Promotion: memoryRepository([promotion]),
    Deliverable: memoryRepository([deliverable]),
    DeliverableSubmission: memoryRepository([...submissions]),
    DeliverableRule: memoryRepository([]),
    Report: memoryRepository([makeReport(80, aliceGroup, 'draft', 'Texte'), makeReport(81, bobGroup, 'draft', 'Autre texte')]),
    ReportConfig: memoryRepository([reportConfig]),
    ReportSectionConfig: memoryRepository([sectionConfig]),
    ReportSection: memoryRepository([]),
    User: memoryRepository([owner, alice, bob, outsider]),
    ...extra,
  });
}

test("le détail d'un projet masque aux étudiants les soumissions et rapports des autres groupes", async () => {
  const withRelations = { ...project, groups: [aliceGroup, bobGroup], deliverables: [{ ...deliverable, submissions }], reports: [makeReport(80, aliceGroup, 'draft', 'Texte'), makeReport(81, bobGroup)], defenses: [], gradingGrids: [{ id: 5, name: 'Grille', criteria: [] }] };
  const restore = install({ Project: memoryRepository([withRelations]) });
  try {
    const detail = await new ProjectService().getProjectDetail(project.id, { id: alice.id, role: 'student' });
    assert.deepEqual(detail.deliverables[0].submissions.map(item => item.groupId), [aliceGroup.id]);
    assert.deepEqual(detail.reports.map(item => item.groupId), [aliceGroup.id]);
    assert.equal(detail.gradingGrids, undefined);
    assert.equal(detail.promotion.students, undefined);
    assert.equal(JSON.stringify(detail).includes('/srv/secret'), false, 'aucun chemin serveur ne doit fuiter');

    const teacherView = await new ProjectService().getProjectDetail(project.id, { id: owner.id, role: 'teacher' });
    assert.equal(teacherView.deliverables[0].submissions.length, 2);
    assert.equal(JSON.stringify(teacherView).includes('/srv/secret'), false);
  } finally { restore(); }
});

test("un étudiant extérieur à la promotion n'accède pas au projet", async () => {
  const restore = install();
  try {
    await rejectsWithStatus(new ProjectService().getProjectDetail(project.id, { id: outsider.id, role: 'student' }), 404);
  } finally { restore(); }
});

test("un enseignant ne peut pas modifier ni supprimer le projet d'un collègue", async () => {
  const restore = install();
  try {
    const service = new ProjectService();
    await rejectsWithStatus(service.updateProject(project.id, 2, { name: 'Piraté' }), 403);
    await rejectsWithStatus(service.deleteProject(project.id, 2), 403);
  } finally { restore(); }
});

test("un étudiant ne lit que le rapport de son groupe", async () => {
  const restore = install();
  try {
    const service = new ReportService();
    const own = await service.getGroupReport(aliceGroup.id, project.id, { id: alice.id, role: 'student' });
    assert.equal(own.id, 80);
    await rejectsWithStatus(service.getGroupReport(bobGroup.id, project.id, { id: alice.id, role: 'student' }), 403);
    await rejectsWithStatus(service.getGroupReport(aliceGroup.id, project.id, { id: 2, role: 'teacher' }), 403);
    await rejectsWithStatus(service.exportPdf(81, { id: alice.id, role: 'student' }), 403);
  } finally { restore(); }
});

test("un étudiant ne peut pas écrire dans le rapport d'un autre groupe", async () => {
  const restore = install();
  try {
    await rejectsWithStatus(new ReportService().saveSectionContent(sectionConfig.id, bobGroup.id, alice.id, '<p>x</p>'), 403);
  } finally { restore(); }
});

test('un rapport soumis est verrouillé et la soumission exige les sections obligatoires', async () => {
  const empty = makeReport(82, aliceGroup);
  const submitted = makeReport(83, aliceGroup, 'submitted', 'Final');
  let restore = install({ Report: memoryRepository([empty]) });
  try {
    await rejectsWithStatus(new ReportService().submitReport(aliceGroup.id, project.id, alice.id), 400);
  } finally { restore(); }

  restore = install({ Report: memoryRepository([submitted]) });
  try {
    await rejectsWithStatus(new ReportService().saveSectionContent(sectionConfig.id, aliceGroup.id, alice.id, '<p>retouche</p>'), 403);
    await rejectsWithStatus(new ReportService().submitReport(aliceGroup.id, project.id, alice.id), 409);
  } finally { restore(); }

  const complete = makeReport(84, aliceGroup, 'draft', '<p>Contenu</p>');
  restore = install({ Report: memoryRepository([complete]) });
  try {
    const result = await new ReportService().submitReport(aliceGroup.id, project.id, alice.id);
    assert.equal(result.status, 'submitted');
  } finally { restore(); }
});

test("le téléchargement d'une soumission est réservé à son groupe et à l'enseignant du projet", async () => {
  const path = require('node:path');
  const inUploads = submission(42, aliceGroup, path.resolve('uploads', 'alice.zip'));
  const restore = install({ DeliverableSubmission: memoryRepository([inUploads, submissions[1]]) });
  try {
    const service = new DeliverableService();
    const file = await service.getSubmissionFile(42, { id: alice.id, role: 'student' });
    assert.equal(file.name, 'rendu.zip');
    await rejectsWithStatus(service.getSubmissionFile(42, { id: bob.id, role: 'student' }), 403);
    await rejectsWithStatus(service.getSubmissionFile(42, { id: 2, role: 'teacher' }), 403);
    assert.ok(await service.getSubmissionFile(42, { id: owner.id, role: 'teacher' }));
  } finally { restore(); }
});

test("un fichier hors du dossier d'uploads n'est jamais servi", async () => {
  const restore = install();
  try {
    await rejectsWithStatus(new DeliverableService().getSubmissionFile(40, { id: alice.id, role: 'student' }), 403);
  } finally { restore(); }
});

test("un étudiant ne peut soumettre que pour son propre groupe", async () => {
  const restore = install();
  try {
    const file = { path: '/tmp/rendu.zip', originalname: 'rendu.zip', size: 10 };
    await rejectsWithStatus(new DeliverableService().submit(deliverable.id, { id: alice.id, role: 'student' }, { groupId: bobGroup.id, file }), 403);
    await rejectsWithStatus(new DeliverableService().submit(deliverable.id, { id: outsider.id, role: 'student' }, { groupId: aliceGroup.id, file }), 404);
  } finally { restore(); }
});

test("l'inscription libre refuse les projets à répartition manuelle et les doubles appartenances", async () => {
  const manual = { ...project, groupFormationRule: 'manual' };
  let restore = install({ Project: memoryRepository([manual]), Group: memoryRepository([{ ...aliceGroup, project: manual }]) });
  try {
    await rejectsWithStatus(new GroupService().joinGroup(aliceGroup.id, bob.id), 403);
  } finally { restore(); }

  restore = install({ Group: memoryRepository([{ ...aliceGroup, members: [alice] }, { ...bobGroup, members: [bob] }]) });
  try {
    await rejectsWithStatus(new GroupService().joinGroup(bobGroup.id, alice.id), 409);
  } finally { restore(); }
});

test("la répartition des groupes refuse un étudiant étranger à la promotion et les doublons", async () => {
  const withGroups = { ...project, groups: [aliceGroup, bobGroup], promotion };
  const restore = install({ Project: memoryRepository([withGroups]) });
  try {
    const service = new GroupService();
    await rejectsWithStatus(service.saveGrouping(project.id, owner.id, [{ id: aliceGroup.id, memberIds: [outsider.id] }]), 400);
    await rejectsWithStatus(service.saveGrouping(project.id, owner.id, [
      { id: aliceGroup.id, memberIds: [alice.id] }, { id: bobGroup.id, memberIds: [alice.id] },
    ]), 400);
    await rejectsWithStatus(service.saveGrouping(project.id, 2, [{ id: aliceGroup.id, memberIds: [alice.id] }]), 403);
  } finally { restore(); }
});

test('seuls les comptes étudiants peuvent être désactivés', async () => {
  const restore = install();
  try {
    await rejectsWithStatus(new UserService().deactivateStudent(owner.id), 403);
    const deactivated = await new UserService().deactivateStudent(alice.id);
    assert.equal(deactivated.isActive, false);
  } finally { restore(); }
});
