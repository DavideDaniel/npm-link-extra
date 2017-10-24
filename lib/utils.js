const fs = require('fs');
const path = require('path');

const { log } = console;

function logPkgsMsg(msg, pkgs) {
  return log(`
${msg}
=======
${pkgs.join('\n')}
`);
}

function checkForLink(name) {
  const modulePath = path.resolve(process.cwd(), 'node_modules', name);
  if (fs.existsSync(modulePath) && fs.statSync(modulePath).isDirectory()) {
    return fs.lstatSync(modulePath).isSymbolicLink();
  }
  return false;
}

function readPkgJson(dir) {
  try {
    return JSON.parse(fs.readFileSync(`${dir}/package.json`, 'utf-8'));
  } catch (err) {
    return log(`No package.json at ${dir}/package.json`);
  }
}

module.exports = {
  logPkgsMsg,
  readPkgJson,
  checkForLink,
};
