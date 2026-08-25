function createSafeBuildEnvironment(environment = process.env) {
  return Object.fromEntries(
    ['APPDATA', 'ComSpec', 'LOCALAPPDATA', 'Path', 'PATHEXT', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE']
      .filter((name) => environment[name])
      .map((name) => [name, environment[name]]),
  );
}

function createNpmRunner({
  runner,
  apiRoot,
  environment = createSafeBuildEnvironment(),
  platform = process.platform,
  commandProcessor = process.env.ComSpec || 'cmd.exe',
}) {
  function npmInvocation(args) {
    if (platform === 'win32')
      return { file: commandProcessor, args: ['/d', '/s', '/c', 'npm.cmd', ...args] };
    return { file: 'npm', args };
  }

  async function install(targetApiRoot = apiRoot) {
    const command = npmInvocation(['ci', '--omit=dev', '--ignore-scripts']);
    await runner.run(command.file, command.args, { cwd: targetApiRoot, environment });
  }

  async function run() {
    const command = npmInvocation(['test']);
    await runner.run(command.file, command.args, { cwd: apiRoot, environment });
  }

  async function installAndTest() {
    await install();
    await run();
  }

  return Object.freeze({ install, run, installAndTest });
}

module.exports = { createNpmRunner, createSafeBuildEnvironment };
