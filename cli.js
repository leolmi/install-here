#!/usr/bin/env node
'use strict';
const u = require('./util.js');
const ih = require('./core.js');
const a = require('yargs').argv;

// npm install-here [<package>] [<target>] [<options>]

u.compose()
  .use(ih.init(a))
  .use(ih.checkOptions)
  .use(ih.checkInstallHere)
  .use(ih.checkPackage)
  .use(ih.retrievePackageVersion)
  .use(ih.checkVersion)
  .use(ih.checkTest)
  .use(ih.deleteTempPath)
  .use(ih.createTempPath)
  .use(ih.execPre)
  .use(ih.install)
  .use(ih.checkConfig)
  .use(ih.delete)
  .use(ih.replace)
  .use(ih.replaceDep)
  .use(ih.deleteTempPath)
  .use(ih.checkGitIgnore)
  .use(ih.saveSettings)
  .use(ih.execPost)
  .run(ih.report);
