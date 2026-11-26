const test = require('node:test');
const assert = require('node:assert/strict');
const { memoryRepository, installRepositories, teacher, student } = require('./helpers.cjs');
const { ProjectService } = require('../dist/services/project.service');

const owner = teacher(1);
const alex = student(10);
const HOUR = 3_600_000;

const group = { id: 1, name: 'Groupe 1', members: [alex] };
const defense = (id, start) => ({ id, group, startTime: new Date(start), endTime: new Date(start + HOUR / 2), orderIndex: id, location: 'Salle A', instructions: null });
const project = {
  id: 1, name: 'Projet', description: '', status: 'visible', teacher: owner, promotion: { id: 1, name: 'M1', students: [alex] },
  groups: [group], deliverables: [], gradingGrids: [{ id: 5, name: 'Soutenance', type: 'defense', weight: 1, criteria: [] }],
  defenses: [defense(2, Date.now() + 5 * HOUR), defense(1, Date.now() + 2 * HOUR)],
};
const reportConfig = { id: 1, project: { id: 1 }, isEnabled: true, deadline: new Date(Date.now() + 24 * HOUR), sections: [{ id: 1 }, { id: 2 }] };

function install() {
  return installRepositories({ Project: memoryRepository([project]), ReportConfig: memoryRepository([reportConfig]) });
}

test('liste des projets : les soutenances sont dans l\'ordre de passage, pour l\'enseignant comme pour l\'étudiant', async () => {
  const restore = install();
  try {
    for (const actor of [owner, alex]) {
      const [item] = await new ProjectService().getMyProjects(actor);
      assert.deepEqual(item.defenses.map(slot => slot.id), [1, 2]);
      assert.equal(item.defenses[0].groupId, 1);
    }
  } finally { restore(); }
});

test('liste des projets : grilles et rapport ne sont donnés qu\'à l\'enseignant', async () => {
  const restore = install();
  try {
    const [forTeacher] = await new ProjectService().getMyProjects(owner);
    assert.deepEqual(forTeacher.gradingGrids.map(grid => grid.type), ['defense']);
    assert.equal(forTeacher.reportConfig.isEnabled, true);
    assert.equal(forTeacher.reportConfig.sectionCount, 2);

    const [forStudent] = await new ProjectService().getMyProjects(alex);
    assert.equal(forStudent.gradingGrids, undefined);
    assert.equal(forStudent.reportConfig, undefined);
  } finally { restore(); }
});
