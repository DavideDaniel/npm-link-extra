const fs = require('fs');
const path = require('path');

const { log } = console;

const pkgHash = {
  startTime: Date.now(),
  cache: {},
};

function logPkgsMsg(msg, pkgs) {
  return log(`
${msg}
=======
${pkgs.join('\n')}
`);
}
const pathToCache = path.join(__dirname, 'cache.json');
const isADir = p => fs.statSync(p).isDirectory();
const cacheExists = fs.existsSync(pathToCache);

function writeToCache(inc) {
  return fs.writeFileSync(pathToCache, JSON.stringify(inc, null, 2), 'utf-8');
}
function readAndParseJSON(pathToJSON, defaultToReturn) {
  if (fs.existsSync(pathToJSON)) {
    try {
      return JSON.parse(fs.readFileSync(pathToJSON, 'utf-8'));
    } catch (error) {
      console.error(error);
      return defaultToReturn;
    }
  }
  return defaultToReturn;
}
const filterOutNodeModules = arr =>
  arr.filter(n => !/(node_modules|\.git|__|.DS_Store|reports|dist)/.test(n)); // NOTE - this needs to be configurable

function findInPath(name, base, fileName, f, r) {
  const files = filterOutNodeModules(f || fs.readdirSync(base));
  const result = r || [];
  for (let idx = 0; idx < files.length; idx += 1) {
    const file = files[idx];
    const newbase = path.join(base, file);
    if (isADir(newbase)) {
      findInPath(name, newbase, fileName, fs.readdirSync(newbase), result);
    } else if (file.substr(-1 * (fileName.length + 1)) === fileName) {
      // eslint-disable-next-line global-require
      const pkgName = require(newbase).name;
      if (pkgName === name) {
        result.push(newbase);
      }
    }
  }
  return result;
}

function cacheOwnModulePaths(hash) {
  const updateCache = {
    lastUpdated: Date.now(),
    cache: {},
  };
  if (cacheExists) {
    const readCache = readAndParseJSON(pathToCache, {});
    const updated = Object.assign(updateCache, readCache, {
      cache: hash.cache,
    });
    writeToCache(updated);
  } else {
    writeToCache(pkgHash);
  }
}

function existsInOwnPath(cwd, name) {
  try {
    if (cacheExists && pkgHash.cache[name]) {
      return pkgHash.cache[name];
    }
    pkgHash.cache[name] = findInPath(name, cwd, 'package.json').length > -1;
    cacheOwnModulePaths(pkgHash);
  } catch (error) {
    throw error;
  }

  return pkgHash.cache[name];
}

function checkForLink(name) {
  const cwd = process.cwd();

  const modulePath = path.resolve(cwd, 'node_modules', name);
  if (fs.existsSync(modulePath) && isADir(modulePath)) {
    const stat = fs.lstatSync(modulePath);
    const isASymLink = stat.isSymbolicLink();
    if (isASymLink) {
      return !existsInOwnPath(cwd, name) && isASymLink;
    }
  }
  return false;
}

function readPkgJson(dir) {
  try {
    return readAndParseJSON(`${dir}/package.json`);
  } catch (err) {
    return log(`No package.json at ${dir}/package.json`);
  }
}

module.exports = {
  logPkgsMsg,
  readPkgJson,
  checkForLink,
};
