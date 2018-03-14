const execa = require('execa');
const fs = require('fs');
const path = require('path');
const { readPkgJson, logPkgsMsg, checkForLink } = require('./utils');

const cwd = process.cwd();
const { dependencies, devDependencies } = require(path.resolve(`${cwd}/package.json`));

const allDeps = Object.assign({}, devDependencies, dependencies);

const { log, error } = console;

let installCmd = 'npm install';
const isUsingYarn = fs.existsSync('yarn.lock');


// check npm version and show warning if needed
function checkNpmVersion() {
  return execa.shell('npm -v')
    .then(({ stdout }) => stdout)
    .then((v) => {
      if (v && !(v.indexOf('3') === 0)) {
        log('Use npm v3.10.10 for unobtrusive symlinks: npm i -g npm@3.10.10');
      }
    });
}

checkNpmVersion();

if (isUsingYarn) {
  log('yarn.lock file detected :: using yarn as npm client for reinstalls');
  installCmd = 'yarn --ignore-scripts';
}

const packageHash = {};

const packageKeys = Object.keys(allDeps);

packageKeys.forEach(function addKeyToHash(key) {
  packageHash[key] = {
    isLinked: checkForLink(key),
  };
});

/**
 * getDirectories returns all directories in a given path
 * @param  {String} pathTo  relative path to monorepo or directory with node modules
 * @return {Array}          array of directories
 */
const getDirectories = (pathTo) => {
  if (!pathTo) {
    throw Error('Need a RELATIVE path to the directory with packages you want to link, eg: (../../my-monorepo/packages)');
  }
  return fs.readdirSync(pathTo)
    .filter((item) => {
      // we want to make sure we don't pick up any . or .DS_Store etc
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

/**
 * getPackages returs all packages
 * @param  {Array} dirs   array of directories
 * @return {Array}        array of packages & the relative path to them
 */
const getPackages = dirs => dirs
  .map((dir) => {
    const pkg = readPkgJson(dir) || {};
    pkg.dir = dir;
    return pkg;
  })
  .filter((pkg) => { return pkg.name; });

// Execa functions

// link packages
function linkPackages(pathToPkgs) {
  const pkgs = pathToPkgs.join(' ');
  return execa
    .shell(`npm link ${pkgs}`)
    .then(() => log('Succesfully linked'));
}

// reinstall after unlinking since unlink deletes the symlink
function reInstall() {
  return execa
    .shell(installCmd, { stdio: 'inherit' });
}

// unlink
function unlinkPackage(arrayOfPkgs) {
  return execa
    .shell(`npm unlink ${arrayOfPkgs.join(' ')}`, { stdio: 'inherit' })
    .then(() => {
      logPkgsMsg('Unlinked', arrayOfPkgs);
      return arrayOfPkgs;
    })
    .then(reInstall, (err) => {
      error(err);
      reInstall();
    });
}

/**
 * getSharedDepDirs selects an array of shared and linked packages
 * @param  {Array} pkgs   An array of dependencies
 * @param  {Object} hash  A hash map of our deps
 * @return {Array}        A filtered list of shared pkg dirs
 */
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
 * getSharedDeps will show any shared dependencies between project & target dir
 * @param  {Array} pkgs   An array of dependencies
 * @param  {Object} hash  A hash map of our deps
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

/**
 * getLinkedDeps returns a list of linked dependencies
 * @param  {Array} pkgs   An array of dependencies
 * @return {Array}        Array of linked dep names
 */
function getLinkedDeps(pkgs) {
  return pkgs.map((name) => {
    const isLinked = checkForLink(name);
    return isLinked ? name : false;
  }).filter(Boolean);
}

// link common dependencies between project & given directory/monorepo
function linkIfExists(pkgs) {
  const sharedDepsDirs = getSharedDepDirs(pkgs, packageHash);

  if (sharedDepsDirs.length) {
    logPkgsMsg('Linking', sharedDepsDirs);
    linkPackages(sharedDepsDirs);
  } else {
    log('No shared dependencies found');
  }
}

// unlink common dependencies between project & given directory/monorepo
function unlinkIfLinked() {
  const sharedDeps = getSharedLinked(packageKeys, packageHash);
  if (sharedDeps.length) {
    unlinkPackage(sharedDeps);
  } else {
    log('No shared linked dependencies found');
  }
}

// show common dependencies between project & given directory/monorepo
function showSharedDeps(pkgs) {
  const sharedDepNames = getSharedDeps(pkgs, packageHash);
  if (sharedDepNames.length) {
    logPkgsMsg('Shared', sharedDepNames);
  } else {
    log('No shared dependencies found');
  }
}

// show all linked dependencies in your node_modules
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
