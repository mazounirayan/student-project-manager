const { AppDataSource } = require('../dist/database/data-source');

function matchValue(actual, expected) {
  if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
    if (expected.type === 'in') return expected.value.includes(actual);
    if (actual === null || actual === undefined) return false;
    return matches(actual, expected);
  }
  return actual === expected;
}

/** Filtre en mémoire équivalent aux `where` imbriqués de TypeORM utilisés par les services. */
function matches(row, where) {
  return Object.entries(where ?? {}).every(([key, expected]) => {
    if (expected === undefined) return true;
    const actual = row[key];
    return Array.isArray(actual) ? actual.some(item => matchValue(item, expected)) : matchValue(actual, expected);
  });
}

function memoryRepository(rows = []) {
  const repository = {
    rows,
    saved: [],
    find: async ({ where } = {}) => rows.filter(row => matches(row, where)),
    findOne: async ({ where } = {}) => rows.find(row => matches(row, where)) ?? null,
    findOneBy: async where => rows.find(row => matches(row, where)) ?? null,
    findOneOrFail: async ({ where }) => rows.find(row => matches(row, where)),
    create: value => ({ ...value }),
    save: async value => {
      const list = Array.isArray(value) ? value : [value];
      list.forEach(item => {
        item.id ??= rows.length + 100;
        repository.saved.push(item);
        if (!rows.includes(item)) rows.push(item);
      });
      return value;
    },
    remove: async value => value,
  };
  return repository;
}

/** Remplace AppDataSource.getRepository par des dépôts en mémoire, indexés par nom d'entité. */
function installRepositories(byEntityName) {
  const original = AppDataSource.getRepository;
  AppDataSource.getRepository = entity => {
    const name = typeof entity === 'function' ? entity.name : entity;
    if (!byEntityName[name]) throw new Error(`Dépôt non simulé : ${name}`);
    return byEntityName[name];
  };
  return () => { AppDataSource.getRepository = original; };
}

const teacher = (id = 1) => ({ id, role: 'teacher', email: `teacher${id}@example.com`, firstName: 'Teacher', lastName: String(id), isActive: true });
const student = (id) => ({ id, role: 'student', email: `student${id}@example.com`, firstName: 'Student', lastName: String(id), isActive: true });

async function rejectsWithStatus(promise, status) {
  await promise.then(
    () => { throw new Error(`Une erreur HTTP ${status} était attendue`); },
    error => { if (error.status !== status) throw error; },
  );
}

module.exports = { memoryRepository, installRepositories, teacher, student, rejectsWithStatus };
