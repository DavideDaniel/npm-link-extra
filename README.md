### npm-link-extra
---
###### v 3.1.0-beta.1

Some useful things we wish npm/yarn link had. Inspired by fs-extra...

One issue currently is the inconsistency between npm's link behavior between the major versions. We have found link to be most stable with version 3.10.10 so that is our recommended npm version.

#### Install
```bash
$ npm install npm-link-extra --save-dev
```

#### Docs
```bash
Usage
  $ nlx <path> -<cmd> --<options>
  $ npx nlx <path> -<cmd> --<options>
Commands
  -h, --help        show help menu
  -l, --link        link all dirs if present in dependencies
  -u, --unlink      unlink all linked dependencies
  -s, --show        show all shared and/or linked dependencies
  -v, --version     get npm-link-extra package version
Options
  -d, --dir         relative path to mononrepo/dir with many modules
  --linked-only     only select currently linked packages
  --shared-only     only select shared dependencies between project and target dir
```