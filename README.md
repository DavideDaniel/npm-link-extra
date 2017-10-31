### npm-link-extra
---
###### v 1.2.0

Some useful things we wish npm/yarn link had. Inspired by fs-extra...

#### Install
```bash
$ npm install npm-link-extra --save-dev
```

#### Docs
```bash
Usage
  $ nl <path> -<cmd> --<options>
  $ npx nl <path> -<cmd> --<options>
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