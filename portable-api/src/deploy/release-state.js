const fs = require('node:fs');
const path = require('node:path');
function createReleaseState(stateRoot) {
  const filePath = path.join(stateRoot, 'current-release.json');
  function read() { return fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath, 'utf8')) : null; }
  function write(release) { fs.mkdirSync(stateRoot, { recursive: true }); fs.writeFileSync(filePath, JSON.stringify(release)); }
  return Object.freeze({ read, write });
}
module.exports = { createReleaseState };
