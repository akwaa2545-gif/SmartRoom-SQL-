const fs = require('node:fs');
const path = require('node:path');

function createReleaseClient({ runner, repository, stateRoot }) {
  function releaseDirectory(tag) { return path.join(stateRoot, tag); }
  async function latestTag() {
    const { stdout } = await runner.run('gh.exe', ['release', 'view', '--repo', repository, '--json', 'tagName', '--jq', '.tagName']);
    const tag = stdout.trim();
    if (!/^portable-api-v[0-9A-Za-z.-]+$/.test(tag)) throw new Error('Latest release tag is invalid.');
    return tag;
  }
  async function prepare(tag) {
    const target = releaseDirectory(tag);
    if (fs.existsSync(path.join(target, 'portable-api', 'src', 'server.js')))
      return { tag, apiRoot: path.join(target, 'portable-api') };
    const temporary = path.join(stateRoot, `${tag}.download`);
    fs.rmSync(temporary, { recursive: true, force: true });
    fs.mkdirSync(temporary, { recursive: true });
    const archive = path.join(temporary, 'portable-api-release.zip');
    try {
      await runner.run('gh.exe', ['release', 'download', tag, '--repo', repository, '--pattern', 'portable-api-release.zip', '--dir', temporary]);
      await runner.run('gh.exe', ['attestation', 'verify', archive, '--repo', repository]);
      const { stdout } = await runner.run('tar.exe', ['-tf', archive]);
      if (stdout.split(/\r?\n/).some((entry) => entry.startsWith('/') || entry.includes('..\\') || entry.includes('../')))
        throw new Error('Verified release archive contains an unsafe path.');
      await runner.run('tar.exe', ['-xf', archive, '-C', temporary]);
      const extracted = path.join(temporary, 'portable-api');
      if (!fs.existsSync(path.join(extracted, 'src', 'server.js'))) throw new Error('Verified release archive is incomplete.');
      const manifestPath = path.join(extracted, 'release-manifest.json');
      if (!fs.existsSync(manifestPath)) throw new Error('Verified release archive has no release manifest.');
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (manifest.tag !== tag || !/^[0-9a-f]{40}$/i.test(manifest.commit || ''))
        throw new Error('Verified release archive is not bound to the selected release tag.');
      fs.renameSync(temporary, target);
      return { tag, apiRoot: path.join(target, 'portable-api') };
    } catch (error) {
      fs.rmSync(temporary, { recursive: true, force: true });
      throw error;
    }
  }
  return Object.freeze({ latestTag, prepare });
}
module.exports = { createReleaseClient };
