const execa = require('execa');
const fs = require('fs');
const path = require('path');
const { readPkgJson, logPkgsMsg, checkForLink } = require('./utils');

const cwd = process.cwd();
const { dependencies } = require(path.resolve(`${cwd}/package.json`));

const { log, error } = console;

let installCmd = 'npm install';
const isUsingYarn = fs.existsSync('yarn.lock');

if (isUsingYarn) {
  log('yarn.lock file detected :: using yarn as npm client');
  installCmd = 'yarn --ignore-scripts';
}

const npmClient = isUsingYarn ? 'yarn' : 'npm';

const packageHash = {};

const packageKeys = Object.keys(dependencies);

packageKeys.forEach(function addKeyToHash(key) {
  packageHash[key] = {
    exists: true,
    isLinked: checkForLink(key),
  };
});

// we want to make sure we don't pick up any . or .DS_Store etc
const getDirectories = (pathTo) => {
  if (!pathTo) {
    throw Error('Need a RELATIVE path to the directory with packages you want to link, eg: (../../my-monorepo/packages)');
  }
  return fs.readdirSync(pathTo)
    .filter((item) => {
      return item[0] !== '.';
    })
    .map((item) => {
      return `${pathTo}/${item}`;
    })
    .filter((item) => {
    // make sure to return only dirs
      return fs.statSync(item).isDirectory();
    });
};


const getPackages = dirs => dirs
  .map((dir) => {
    const pkg = readPkgJson(dir) || {};
    return { name: pkg.name, dir };
  })
  .filter((pkg) => { return pkg.name; });


function linkPackages(pathToPkgs) {
  const pkgs = pathToPkgs.join(' ');
  return execa
    .shell(`${npmClient} link ${pkgs}`)
    .then(() => log('Succesfully linked'));
}

function reInstall() {
  return execa
    .shell(installCmd, { stdio: 'inherit' });
}

function unlinkPackage(arrayOfPkgs) {
  return execa
    .shell(`${npmClient} unlink ${arrayOfPkgs.join(' ')}`, { stdio: 'inherit' })
    .then(() => {
      logPkgsMsg('Unlinked', arrayOfPkgs);
      return arrayOfPkgs;
    })
    .then(reInstall, (err) => {
      error(err);
      reInstall();
    });
}

function getSharedDepDirs(pkgs, hash) {
  return pkgs.map(({ name, dir }) => {
    if (hash[name]) {
      return dir;
    }
    return false;
  }).filter(Boolean);
}


/**
 * getSharedLinked selects an array of shared and linked packages
 * @param  {Array} pkgs   An array of dependencies
 * @param  {Object} hash  A hash map of our deps
 * @return {Array}        A filtered list of packages
 */
function getSharedLinked(pkgs, hash) {
  return pkgs.map((name) => {
    const module = hash[name];
    if (module && module.isLinked) {
      return name;
    }
    return false;
  }).filter(Boolean);
}

/**
 * showSharedDeps will show any shared dependencies between project & target dir
 * @return {Array}  Array of shared dep names
 */
function getSharedDeps(pkgs, hash) {
  return pkgs.map(({ name }) => {
    if (hash[name]) {
      return name;
    }
    return false;
  }).filter(Boolean);
}

function getLinkedDeps(pkgs) {
  return pkgs.map((name) => {
    const isLinked = checkForLink(name);
    return isLinked ? name : false;
  }).filter(Boolean);
}

function linkIfExists(pkgs) {
  const sharedDepsDirs = getSharedDepDirs(pkgs, packageHash);

  if (sharedDepsDirs.length) {
    logPkgsMsg('Linking', sharedDepsDirs);
    linkPackages(sharedDepsDirs);
  } else {
    log('No shared dependencies found');
  }
}

function unlinkIfLinked() {
  const sharedDeps = getSharedLinked(packageKeys, packageHash);
  if (sharedDeps.length) {
    unlinkPackage(sharedDeps);
  } else {
    log('No shared linked dependencies found');
  }
}

function showSharedDeps(pkgs) {
  const sharedDepNames = getSharedDeps(pkgs, packageHash);
  if (sharedDepNames.length) {
    logPkgsMsg('Shared', sharedDepNames);
  } else {
    log('No shared dependencies found');
  }
}

function showLinkedDeps() {
  const linkedDeps = getLinkedDeps(packageKeys, packageHash);
  if (linkedDeps.length) {
    logPkgsMsg('Linked', linkedDeps);
  } else {
    log('No linked dependencies found');
  }
}

module.exports = {
  // selectors
  getPackages,
  getDirectories,
  getLinkedDeps,
  getSharedDeps,
  getSharedLinked,
  getSharedDepDirs,
  // commands
  linkIfExists,
  unlinkIfLinked,
  showSharedDeps,
  showLinkedDeps,
};
