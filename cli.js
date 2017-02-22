#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var _ = require('lodash');
var u = require('./util.js');
var rimraf = require('rimraf');
var info = require('./package.json');

var INSTALL_HERE_FOLDER = '.install-here';
var NODE_MODULES_FOLDER = 'node_modules';
var INSTALL_HERE_CONFIG = 'install-here.json';

// npm install-here package path
var _package = process.argv[2];
var _package_version = null;
var _target = process.argv[3];
var _error = null;
var _exit = null;
var _force = false;
var _temp = '';
var _root = process.cwd();
var _files = [];
var _dependecies = [];
var _counter = 0;
var _counterDep = 0;
var _relpath = path.join(INSTALL_HERE_FOLDER,NODE_MODULES_FOLDER,_package);
var _settings = {};
var settings = function(s) {
  this.ignore = '';
  this.ignoreOverwrite = '';
  this.checkVersion = true;
  if (s) _.extend(this, s);
  var self = this;
  this._filters = {
    ignore: u.getPathFilters(self.ignore),
    ignoreOverwrite: u.getPathFilters(self.ignoreOverwrite)
  }
};

function _isExit() {
  return _exit||_error;
}

function _handleErr(cb) {
  return function(err) {
    if (err) _error = err;
    cb();
  }
}

function _init(cb) {
  _error = null;
  _temp = '';
  _files = [];
  _dependecies = [];
  _counter = 0;
  _package_version = null;
  var cnfpath = path.join(_root, INSTALL_HERE_CONFIG);
  var s = (fs.existsSync(cnfpath)) ? require(cnfpath)||{} : {};
  _settings = new settings(s);
  console.log('%s v.%s', info.name, info.version);
  cb();
}

function _checkOptions(cb) {
  switch(_target) {
    case '-f':
    case '--force':
      _force = true;
      _target = null;
      break;
  }
  switch(_package) {
    case '-v':
    case '--version':
      _exit = ['%s v.%s', info.name, info.version];
      break;
    default:
      console.log('package: %s,  target: %s', _package, _target||'current directory');
  }
  cb();
}

// retrieve remote package version
function _packageVersion(cb) {
  if (_isExit()) return cb();
  cp.exec('npm view ' + _package + ' version', function (err, out) {
    if (out) {
      _package_version = out.trim();
      console.log('remote version: %s', _package_version);
    }
    cb();
  });
}

// check the package version
function _checkVersion(cb) {
  if (_isExit() || _force) return cb();
  if (_settings.checkVersion && _package_version) {
    var exsinfopath = path.join(_root, 'package.json');
    if (fs.existsSync(exsinfopath)) {
      var xinfo = require(exsinfopath);
      if (xinfo.name == _package && xinfo.version == _package_version) {
        _exit = ['package "%s" is up-to-date.', _package];
      }
    }
  }
  cb();
}

// creates temporary path
function _createTempPath(cb) {
  if (_isExit()) return cb();
  console.log('creates temporary path');
  var temp = path.join(_root, INSTALL_HERE_FOLDER);
  fs.mkdir(temp, function(err){
    if (err) {
      _error = err;
      cb();
    } else {
      _temp = path.join(temp, NODE_MODULES_FOLDER);
      fs.mkdir(_temp, _handleErr(cb));
    }
  });
}

// remove temporary path
function _deleteTemp(cb) {
  var temp = path.join(_root, INSTALL_HERE_FOLDER);
  if (fs.existsSync(temp)) {
    console.log('remove temporary path');
    rimraf(temp, _handleErr(cb));
  } else {
    cb();
  }
}

// install package
function _install(cb) {
  if (_isExit()) return cb();
  console.log('installing package...');
  var process = cp.exec('npm install '+_package,{cwd: _temp+'/'}, function(err, out){
    if (err) _error = err;
    if (out) console.log('install output:\n'+out);
    cb();
  });
  process.on('error', _handleErr(cb));
}

// check the path
function _checkPathX(relfolder) {
  var parts = relfolder.split(path.sep);
  var checked = _root;
  var index = 0;
  do {
    checked = path.join(checked, parts[index]);
    if (!fs.existsSync(checked))
      fs.mkdirSync(checked);
    index++;
  } while (index < parts.length);
}

// check the file path
function _checkPath(f) {
  var folder = path.dirname(f);
  var relfolder = folder.slice(_root.length+1);
  if (relfolder)
    _checkPathX(relfolder)
}

// updates file
function _replacePkgFile(f) {
  var nf = f.replace(_relpath + path.sep, '');
  if (_settings._filters.ignore.check(nf)) {
    console.log('Skip file: '+nf);
    return;
  }
  _checkPath(nf);
  if (fs.existsSync(nf)) {
    if (_settings._filters.ignoreOverwrite.check(nf)) {
      console.log('Skip overwriting file: '+nf);
      return;
    }
    fs.unlinkSync(nf);
  }
  console.log('replace file: ' + nf);
  var data = fs.readFileSync(f);
  fs.writeFileSync(nf, data);
  _counter++;
}

function _replaceDepFile(f) {
  var nf = path.join(_root, path.join(NODE_MODULES_FOLDER, path.relative(_temp, f)));
  _checkPath(nf);
  if (fs.existsSync(nf)) {
    fs.unlinkSync(nf);
  }
  console.log('replace dependency file: ' + nf);
  var data = fs.readFileSync(f);
  fs.writeFileSync(nf, data);
  _counterDep++;
}

function _allFiles(list, folder, ignore) {
  fs.readdirSync(folder).forEach(function(f) {
    var fn = path.join(folder, f);
    if (fs.statSync(fn).isDirectory()) {
      if (!ignore || fn.indexOf(ignore)<0)
        _allFiles(list, fn);
    } else {
      list.push(fn);
    }
  });
}

// updates files
function _replace(cb) {
  if (_isExit()) return cb();
  console.log('updates package files');
  try {
    _allFiles(_files, path.join(_temp, _package));
    _files.forEach(_replacePkgFile);
    cb();
  } catch(err) {
    _handleErr(cb)(err);
  }
}

// updates dependencies
function _replaceDep(cb) {
  if (_isExit()) return cb();
  console.log('updates dependencies files');
  try {
    _allFiles(_dependecies, path.join(_temp), path.join(_temp, _package));
    _dependecies.forEach(_replaceDepFile);
    cb();
  } catch(err) {
    _handleErr(cb)(err);
  }
}

function _saveSettings(cb) {
  var cnfpath = path.join(_root, INSTALL_HERE_CONFIG);
  if (!fs.existsSync(cnfpath)) {
    var ser = _.clone(_settings);
    delete ser._filters;
    var data = JSON.stringify(ser, null, 2);
    fs.writeFileSync(cnfpath, data);
  }
  cb();
}

u.compose()
  .use(_init)
  .use(_checkOptions)
  .use(_packageVersion)
  .use(_checkVersion)
  .use(_deleteTemp)
  .use(_createTempPath)
  .use(_install)
  .use(_replace)
  .use(_replaceDep)
  .use(_deleteTemp)
  .use(_saveSettings)
  .run(function() {
    if (_exit) {
      console.log.apply(null, _exit);
    } else if (_error) {
      console.log('Done with errors');
      throw _error;
    } else {
      console.log('Done: \n\t%d package files updates\n\t%d dependencies files updates', _counter, _counterDep);
    }
  });


// function _test() {
//   var files = [
//     'C:\\Sviluppo\\bower_components\\sghereghen\\client\\ciccio.js',
//     'C:\\Sviluppo\\bower_components\\client\\ciccio.txt',
//     'C:\\Sviluppo\\frottole\\sghereghen\\client\\popo.js'
//   ];
//   var filter = '*/bower_components/**/*.js;*.json;ciccio.txt;bower_components/*.txt';
//   var fo = u.getPathFilters(filter);
//   var fdesc = _.map(fo.items, function(fi){
//     return '\t '+fi.str + '     {'+fi.strTemp+'}  >>>    '+fi.strFilter;
//   });
//   console.log('TEST start, filters: \n'+ fdesc.join('\n'));
//   console.log('filter: \n\t'+ fo.str+'\n\n');
//   files.forEach(function(f){
//     var msg = fo.check(f) ? '-      SKIP file: %s' : '+OK: %s';
//     console.log(msg, f);
//   });
// }
//
// _test();