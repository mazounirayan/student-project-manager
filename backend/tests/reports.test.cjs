const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryRepository, installRepositories, teacher, student, rejectsWithStatus } = require('./helpers.cjs');
const { ReportService } = require('../dist/services/report.service');

const owner = teacher(1);
const alice = student(10);
const bob = student(11);
const promotion = { id: 1, name: 'Promo', teacher: owner, students: [alice, bob] };
const project = { id: 1, name: 'Projet', status: 'visible', teacher: owner, promotion, promotionId: 1 };
const group = { id: 20, name: 'Groupe A', project, members: [alice, bob] };

const DAY = 86_400_000;

/** Un rapport d'un groupe de deux étudiants, dont l'unique section a été enregistrée par `author`. */
function fixture({ deadline = null, author = alice, savedAt = new Date('2026-11-26T14:00:00.000Z') } = {}) {
  const config = { id: 60, project, isEnabled: true, deadline, sections: [] };
  const sectionConfig = { id: 70, title: 'Introduction', required: true, orderIndex: 1, config };
  config.sections.push(sectionConfig);
  const section = { id: 900, content: '<p>Version d’Alice</p>', updatedAt: savedAt, updatedBy: author, sectionConfig };
  const report = { id: 80, title: 'Rapport', project, group, status: 'draft', sections: [section] };
  const restore = installRepositories({
    Group: memoryRepository([group]),
    ReportConfig: memoryRepository([config]),
    ReportSectionConfig: memoryRepository([sectionConfig]),
    Report: memoryRepository([report]),
    ReportSection: memoryRepository([]),
  });
  return { restore, section, sectionConfig };
}

const asBob = { id: bob.id, role: 'student' };

test('après la date limite, le rapport est en lecture seule', async () => {
  const { restore, sectionConfig } = fixture({ deadline: new Date(Date.now() - DAY) });
  try {
    await rejectsWithStatus(new ReportService().saveSectionContent(sectionConfig.id, group.id, bob.id, '<p>trop tard</p>'), 403);
    await rejectsWithStatus(new ReportService().submitReport(group.id, project.id, bob.id), 403);
  } finally { restore(); }
});

test("avant la date limite, l'enregistrement reste possible", async () => {
  const { restore, sectionConfig } = fixture({ deadline: new Date(Date.now() + DAY) });
  try {
    const saved = await new ReportService().saveSectionContent(sectionConfig.id, group.id, bob.id, '<p>à temps</p>');
    assert.equal(saved.content, '<p>à temps</p>');
  } finally { restore(); }
});

test("l'enregistrement d'une version périmée est refusé plutôt que d'écraser le texte d'un coéquipier", async () => {
  const { restore, section, sectionConfig } = fixture();
  try {
    const stale = new Date('2026-11-26T13:00:00.000Z').toISOString();
    await rejectsWithStatus(new ReportService().saveSectionContent(sectionConfig.id, group.id, bob.id, '<p>Version de Bob</p>', stale), 409);
    assert.equal(section.content, '<p>Version d’Alice</p>', 'le texte d’Alice est intact');

    // Section jamais vue par Bob alors qu'Alice l'a déjà écrite : même refus.
    await rejectsWithStatus(new ReportService().saveSectionContent(sectionConfig.id, group.id, bob.id, '<p>Version de Bob</p>', null), 409);
  } finally { restore(); }
});

test("l'enregistrement à partir de la dernière version est accepté et garde la trace de l'auteur", async () => {
  const { restore, section, sectionConfig } = fixture();
  try {
    const current = section.updatedAt.toISOString();
    const saved = await new ReportService().saveSectionContent(sectionConfig.id, group.id, bob.id, '<p>Version de Bob</p>', current);
    assert.equal(section.content, '<p>Version de Bob</p>');
    assert.deepEqual(saved.updatedBy, { id: bob.id, firstName: bob.firstName, lastName: bob.lastName });
  } finally { restore(); }
});

test("un étudiant ne se met pas en conflit avec lui-même, ni avec un texte identique", async () => {
  const { restore, section, sectionConfig } = fixture({ author: bob });
  try {
    const stale = new Date('2026-11-26T13:00:00.000Z').toISOString();
    await new ReportService().saveSectionContent(sectionConfig.id, group.id, bob.id, '<p>Encore Bob</p>', stale);
    assert.equal(section.content, '<p>Encore Bob</p>');
  } finally { restore(); }

  const same = fixture();
  try {
    await new ReportService().saveSectionContent(same.sectionConfig.id, group.id, bob.id, '<p>Version d’Alice</p>', new Date(0).toISOString());
  } finally { same.restore(); }
});
