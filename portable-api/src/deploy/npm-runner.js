function createSafeBuildEnvironment(environment = process.env) {
  return Object.fromEntries(
    ['APPDATA', 'ComSpec', 'LOCALAPPDATA', 'Path', 'PATHEXT', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE']
      .filter((name) => environment[name])
      .map((name) => [name, environment[name]]),
  );
}

function createNpmRunner({ runner, apiRoot, environment = createSafeBuildEnvironment() }) {
  async function install(targetApiRoot = apiRoot) {
    await runner.run('npm.cmd', ['ci', '--omit=dev', '--ignore-scripts'], { cwd: targetApiRoot, environment });
  }

  async function run() {
    await runner.run('npm.cmd', ['test'], { cwd: apiRoot, environment });
  }

  async function installAndTest() {
    await install();
    await run();
  }

  return Object.freeze({ install, run, installAndTest });
}

module.exports = { createNpmRunner, createSafeBuildEnvironment };
