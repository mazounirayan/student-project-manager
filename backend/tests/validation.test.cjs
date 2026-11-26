const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const AdmZip = require('adm-zip');
const { evaluateRules } = require('../dist/utils/file-validation.service');
const { compareFingerprints, fingerprintArchive } = require('../dist/utils/similarity.service');

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'spm-tests-'));
test.after(() => fs.rmSync(directory, { recursive: true, force: true }));

function makeZip(name, files) {
  const zip = new AdmZip();
  for (const [entry, content] of Object.entries(files)) zip.addFile(entry, Buffer.from(content));
  const target = path.join(directory, name);
  zip.writeZip(target);
  return target;
}

const rule = (type, configuration, errorMessage = null) => ({ type, configuration: JSON.stringify(configuration), errorMessage });

test("les règles d'un livrable sont évaluées sur le contenu de l'archive", () => {
  const filePath = makeZip('ok.zip', { 'projet/README.md': '# Titre\nHello', 'projet/src/main.js': 'console.log(1)' });
  const { allPassed, rules } = evaluateRules([
    rule('max_size', { maxSizeMB: 1 }),
    rule('file_presence', { requiredFiles: ['README.md'] }),
    rule('folder_structure', { expectedStructure: ['src'] }),
    rule('file_content', { fileName: 'README.md', contentRegex: '^# Titre' }),
  ], { filePath });
  assert.equal(allPassed, true);
  assert.equal(rules.length, 4);
});

test('une règle en échec renvoie le message personnalisé de l\'enseignant', () => {
  const filePath = makeZip('ko.zip', { 'main.js': 'x' });
  const { allPassed, rules } = evaluateRules([
    rule('file_presence', { requiredFiles: ['README.md'] }, 'Ajoutez un README.'),
    rule('folder_structure', { expectedStructure: ['docs'] }),
  ], { filePath });
  assert.equal(allPassed, false);
  assert.equal(rules[0].message, 'Ajoutez un README.');
  assert.match(rules[1].message, /docs/);
});

test("un fichier qui n'est pas un ZIP ou une absence de fichier échoue proprement", () => {
  const notZip = path.join(directory, 'plain.zip');
  fs.writeFileSync(notZip, 'pas une archive');
  assert.equal(evaluateRules([rule('file_presence', { requiredFiles: ['a'] })], { filePath: notZip }).allPassed, false);
  assert.equal(evaluateRules([rule('max_size', { maxSizeMB: 1 })], {}).allPassed, false);
  assert.equal(evaluateRules([rule('max_size', { maxSizeMB: 1 })], { gitUrl: 'https://example.com/repo.git' }).allPassed, true);
});

test('la similarité détecte les copies et ignore les projets distincts', () => {
  const code = (seed) => Array.from({ length: 30 }, (_, i) => `const value${seed}${i} = compute(${i}) + ${seed};`).join('\n');
  const original = fingerprintArchive(makeZip('a.zip', { 'main.js': code('a') }));
  const copy = fingerprintArchive(makeZip('b.zip', { 'src/main.js': code('a') }));
  const other = fingerprintArchive(makeZip('c.zip', { 'main.js': code('z') }));

  assert.equal(compareFingerprints(original, copy).finalScore, 1);
  assert.equal(compareFingerprints(original, other).finalScore, 0);
  assert.equal(fingerprintArchive(path.join(directory, 'plain.zip')), null);
});
