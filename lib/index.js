const execa = require('execa');
const fs = require('fs');
const path = require('path');
const {
  readPkgJson,
  logPkgsMsg,
  checkForLink,
  debugLogging,
} = require('./utils');

const cwd = process.cwd();
const { dependencies, devDependencies } = require(path.resolve(`${cwd}/package.json`));

const allDeps = Object.assign({}, devDependencies, dependencies);

let installCmd = 'npm install';
const hasYarnLock = fs.existsSync('yarn.lock');
const installedNpmClient = hasYarnLock ? 'yarn' : 'npm';
const npmClient = process.env.NLX_NPM_CLIENT
  ? process.env.NLX_NPM_CLIENT
  : installedNpmClient;
const isUsingYarn = npmClient === 'yarn';

if (isUsingYarn) {
  console.log('yarn.lock file detected :: using yarn as npm client for reinstalls');
  installCmd = 'yarn --ignore-scripts';
}

console.log(`Using ${npmClient} for operations. You can override this by setting an env var of NLX_NPM_CLIENT as "npm" or "yarn".`);

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
  return fs
    .readdirSync(pathTo)
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
const getPackages = dirs =>
  dirs
    .map((dir) => {
      const pkg = readPkgJson(dir) || {};
      pkg.dir = dir;
      return pkg;
    })
    .filter((pkg) => {
      return pkg.name;
    });

// Execa functions

// reinstall after unlinking since unlink deletes the symlink
function reInstall() {
  if (isUsingYarn) {
    return execa.shellSync(`${installCmd} --force`, { stdio: 'inherit' });
  }
  return execa.shellSync(installCmd, { stdio: 'inherit' });
}

/**
 * getSharedDepDirs selects an array of shared and linked packages
 * @param  {Array} pkgs   An array of dependencies
 * @param  {Object} hash  A hash map of our deps
 * @return {Array}        A filtered list of shared pkg dirs
 */
function getSharedDepDirs(pkgs, hash) {
  return pkgs
    .map(({ name, dir }) => {
      if (hash[name]) {
        return dir;
      }
      return false;
    })
    .filter(Boolean);
}

/**
 * getSharedLinked selects an array of shared and linked packages
 * @param  {Array} pkgs   An array of dependencies
 * @param  {Object} hash  A hash map of our deps
 * @return {Array}        A filtered list of packages
 */
function getSharedLinked(pkgs, hash) {
  return pkgs
    .map((name) => {
      const module = hash[name];
      if (module && module.isLinked) {
        return name;
      }
      return false;
    })
    .filter(Boolean);
}

/**
 * getSharedDeps will show any shared dependencies between project & target dir
 * @param  {Array} pkgs   An array of dependencies
 * @param  {Object} hash  A hash map of our deps
 * @return {Array}  Array of shared dep names
 */
function getSharedDeps(pkgs, hash) {
  return pkgs
    .map(({ name }) => {
      if (hash[name]) {
        return name;
      }
      return false;
    })
    .filter(Boolean);
}

/**
 * getLinkedDeps returns a list of linked dependencies
 * @param  {Array} pkgs   An array of dependencies
 * @return {Array}        Array of linked dep names
 */
function getLinkedDeps(pkgs) {
  return pkgs
    .map((name) => {
      const isLinked = checkForLink(name);
      return isLinked ? name : false;
    })
    .filter(Boolean);
}

// show all linked dependencies in your node_modules
function showLinkedDeps() {
  const linkedDeps = getLinkedDeps(packageKeys, packageHash);
  if (linkedDeps.length) {
    logPkgsMsg('Linked', linkedDeps);
  } else {
    console.log('No linked dependencies found');
  }
}

function createLinks(pkgs) {
  if (pkgs.length === 0) {
    console.log('Done.');
    return showLinkedDeps();
  }
  const toLink = [];
  const ignore = pkgs
    .map((pkg) => {
      const { name } = pkg;
      if (checkForLink(name)) {
        debugLogging(`${name} is already linked.`);
        return name;
      }
      return null;
    })
    .filter(Boolean);

  while (pkgs.length && pkgs[0]) {
    const { name, dir } = pkgs[0];
    if (ignore.includes(name)) {
      debugLogging(`Ignoring already linked: ${name}.`);
      pkgs.splice(0, 1);
      debugLogging('Make recursive call');
      return createLinks(pkgs);
    }

    const cmd = isUsingYarn ? `${npmClient} link` : `${npmClient} link ${dir}`;
    const cmdDir = isUsingYarn ? dir : cwd;
    debugLogging(`Linking ${name} with "${cmd}" from ${dir}`);
    execa.shellSync(cmd, {
      cwd: cmdDir,
      stdio: 'inherit',
    });
    toLink.push(name);
    pkgs.splice(0, 1);
  }
  execa.shellSync(`${npmClient} link ${toLink.join(' ')}`, {
    cwd,
    stdio: 'inherit',
  });
  return console.log('Done linking modules with yarn.');
}

// link packages
function linkPackages(pathToPkgs) {
  const pkgs = pathToPkgs.join(' ');
  return execa
    .shell(`${npmClient} link ${pkgs}`)
    .then(() => console.log('Succesfully linked'));
}

// unlink
function unlinkPackages(pkgs) {
  if (npmClient === 'yarn') {
    const toLink = [];
    while (pkgs.length && pkgs[0]) {
      const { name, dir } = pkgs[0];
      const cmd = `${npmClient} unlink`;
      console.log(`Unlinking ${name} with "${cmd}" at ${dir}`);
      try {
        toLink.push(name);
        pkgs.splice(0, 1);
      } catch (err) {
        debugLogging(err);
        // error(err);
      }
    }
    execa.shellSync(`${npmClient} unlink ${toLink.join(' ')}`, {
      cwd,
      stdio: 'inherit',
    });
    return console.log('Done unlinking packages with yarn.');
  }
  execa.shellSync(
    `${npmClient} unlink ${getSharedDeps(pkgs, packageHash).join(' ')}`,
    {
      stdio: 'inherit',
    }
  );
  return console.log('Done unlinking packages.');
}

// link common dependencies between project & given directory/monorepo
function linkIfExists(pkgs) {
  const sharedDepsDirs = getSharedDepDirs(pkgs, packageHash);
  const numOfLinked = sharedDepsDirs.length;
  debugLogging(`Linking ${numOfLinked} packages`);
  if (numOfLinked) {
    logPkgsMsg('Linking', sharedDepsDirs);
    if (isUsingYarn) {
      return createLinks(pkgs);
    }
    return linkPackages(sharedDepsDirs);
  }
  return console.log('No shared dependencies found');
}

// unlink common dependencies between project & given directory/monorepo
function unlinkIfLinked(pkgs) {
  const sharedDeps = getSharedLinked(packageKeys, packageHash);
  const numOfLinked = sharedDeps.length;
  if (numOfLinked) {
    debugLogging(`Unlinking ${numOfLinked} packages`);
    unlinkPackages(pkgs);
    console.log('Reinstalling for your convenience. You can cancel if needed and reinstall or re-link.');
    reInstall();
  } else {
    console.log('No shared linked dependencies found');
  }
}

// show common dependencies between project & given directory/monorepo
function showSharedDeps(pkgs) {
  const sharedDepNames = getSharedDeps(pkgs, packageHash);
  if (sharedDepNames.length) {
    logPkgsMsg('Shared', sharedDepNames);
  } else {
    console.log('No shared dependencies found');
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
