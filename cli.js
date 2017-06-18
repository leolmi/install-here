#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var _ = require('lodash');
var u = require('./util.js');
var rimraf = require('rimraf');
var info = require('./package.json');
var argv = require('yargs').argv;

var INSTALL_HERE_FOLDER = '.install-here';
var NODE_MODULES_FOLDER = 'node_modules';
var INSTALL_HERE_CONFIG = 'install-here.json';
var PACKAGE_CONFIG = 'package.json';
var CHANGE_LOG = 'changelog.md';

// npm install-here [<package>] [<target>] [<options>]

// package
var _package = null;
// errori
var _error = null;
// argomento d'uscita
var _exit = null;
// path temporanea di installazione moduli
var _temp = '';
// root di esecuzione
var _root = process.cwd();
// elenco file processati
var _files = [];
// elenco dipendenze
var _dependecies = [];
// contatori
var _counters = null;
// path relativo
var _relpath = '';
// impostazioni
var _settings = {};
// opzioni
var _options = {};
// permette di eliminare il folder temporaneo
var _force_first = true;


var Settings = function(s, o) {
  this.ignore = '';
  this.ignoreOverwrite = '';
  this.ignorePath = '';
  this.checkVersion = true;
  if (s) _.extend(this, s);
  var self = this;
  this._filters = {
    ignore: u.getPathFilters(self.ignore),
    ignoreOverwrite: u.getPathFilters(self.ignoreOverwrite, INSTALL_HERE_CONFIG),
    ignorePath: u.getPathFilters(self.ignorePath)
  };
  this.xpre = this.xpre || o.xpre;
  this.xpost = this.xpost || o.xpost;
};
var Package = function(p) {
  this.fullName = p||'';
  var parts = (p||'').split('@');
  this.name = parts[0];
  this.version = parts.length > 1 ? parts[1] : '';
  this.xversion = '';
};
Package.prototype = {
  getInstallName: function() {
    return this.name+'@'+this.version;
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

function _log(m, m1) {
  if (_options.verbose||_options.debug) {
    console.log(m);
  } else if (m1) {
    console.log(m1);
  }
}

function _logi(m) {
  process.stdout.write(m);
}

function _init(cb) {
  _options = {
    version: argv.v || argv.version || argv.ver,
    history: argv.vh || argv.verhist,
    force: argv.f || argv.force,
    verbose: argv.verbose,
    debug: argv.d || argv.debug,
    test: argv.t || argv.test,
    skipkg: !!argv.skipkg,
    help: !!argv.h || argv.help,
    xpre: argv.xpre,
    xpost: argv.xpost,
    patch: !!argv.patch,
    target: '' //argv.target
  };
  _counters = {
    files: 0,
    dependencies: 0
  };
  _error = null;
  _temp = '';
  _files = [];
  _dependecies = [];
  var name = (argv._.length > 0) ? argv._[0] : null;
  _package = new Package(name);
  var cnfpath = path.join(_root, INSTALL_HERE_CONFIG);
  var s = (fs.existsSync(cnfpath)) ? require(cnfpath) || {} : {};
  _settings = new Settings(s, _options);
  _log('settings: '+JSON.stringify(_settings));
  _force_first = true;
  cb();
}

function _checkInstallHere(cb) {
  //TODO: check the install-here version
  cb();
}

function _checkOptions(cb) {
  if (_options.help) {
    var help ='\tinstall-here [<package>] [<options>]\n\n'+
      '\t<package>\tpackage name (optional)\n'+
      '\t<options>\toptions (optional):\n'+
      '\t\t--version,-v:\tshows version\n'+
      '\t\t--verhist,-vh:\tshows version history\n'+
      '\t\t--force,-f:\tforce update\n'+
      '\t\t--verbose:\tshow the verbose log\n'+
      '\t\t--debug,-d:\tworks in debug mode\n'+
      '\t\t--patch,-p:\tinstall in patch mode\n'+
      '\t\t--skipkg:\tskip package.json check\n'+
      '\t\t--help,-h:\tshows the help\n';
    _exit = ['%s v.%s\n%s', info.name, info.version, help];
  } else if (_options.version) {
    var v = u.version(info.version);
    var rgx =  new RegExp('## '+v+'[\n]*([^#]*)', 'g');
    var logfile = path.join(__dirname, CHANGE_LOG);
    var log = (fs.existsSync(logfile)) ? fs.readFileSync(logfile) : '';
    var m = rgx.exec(log);
    var cnglog = _options.verbose ? log : (m?m[1]:'');
    _exit = ['%s v.%s \n\n%s', info.name, info.version, cnglog];
  } else if (_options.history) {
    var histfile = path.join(__dirname, CHANGE_LOG);
    var hist = (fs.existsSync(histfile)) ? fs.readFileSync(histfile) : '';
    _exit = ['%s version history:\n', info.name, hist.toString()];
  } else {
    console.log('%s v.%s', info.name, info.version);
  }
  cb();
}

// check the package name
function _checkPackage(cb) {
  if (_isExit()) return cb();
  var pkgroot = path.join(_root, _options.target, PACKAGE_CONFIG);
  var pkg = (fs.existsSync(pkgroot)) ? require(pkgroot) : null;
  if (!_package.name) {
    if (!_options.patch && pkg) {
      _package.name = pkg.name;
      _package.xversion = u.version(pkg.version);
    }
  } else if (pkg && !_options.patch) {
    if (pkg.name == _package.name) {
      _package.xversion = u.version(pkg.version);
    } else {
      _error = 'Other package not allowed (current: "' + pkg.name +
        '")\n\tuse --patch option to merging with other package!';
    }
  } else if (!pkg && _options.patch) {
    _error = 'Nothing to patch!\n\tinstall base package before.';
  }
  if (_isExit()) return cb();

  if (!_package.name) {
    _error = 'Undefined package!\n\tuse: install-here <package> [<options>]';
  } else {
    _relpath = path.join(INSTALL_HERE_FOLDER, NODE_MODULES_FOLDER, _package.name);
    // console.log('package: %s   >  target: %s', _package.name, _options.target || 'current directory');
  }
  if (_options.debug) _log(null, 'package: '+JSON.stringify(_package));
  cb();
}

// retrieve remote package version
function _retrievePackageVersion(cb) {
  if (_isExit()) return cb();
  var patch = _options.patch?' as patch':'';
  if (!_package.version) {
    var cmd = 'npm view ' + _package.name + ' version -g';
    if (_options.debug) console.log('Try to retrieve version: "%s"', cmd);
    cp.exec(cmd, function (err, out) {
      if (out) {
        _package.version = out.trim();
        console.log('found %s v.%s %s', _package.name, _package.version, patch);
      }
      if (err && _options.debug)
        console.error(err);
      cb();
    });
  } else {
    console.log('installing %s v.%s %s', _package.name, _package.version, patch);
    cb();
  }
}

// check the package version
function _checkVersion(cb) {
  if (_isExit() || (!_options.patch && (_options.force || !_settings.checkVersion))) return cb();
  if (_package.version && !_options.patch) {
    if (_package.version == _package.xversion) {
      _exit = ['package "%s" is up-to-date.', _package.name];
    } else if (_package.xversion) {
      console.log('current %s v.%s', _package.name, _package.xversion);
    }
  }
  if (!_package.version) {
    _error = 'Package version not found!';
  }
  cb();
}

function _checkTest(cb) {
  if (_isExit()) return cb();
  if (_options.test) _exit = ['test finished.'];
  cb();
}

function _execAction(cmd, cb) {
  if (_isExit() || !cmd) return cb();
  _log(null, 'exec script: '+cmd);
  var process = cp.exec(cmd, {cwd: _root + '/'}, function (err, out) {
    if (err) _error = err;
    if (out) _log('action output:\n' + out);
    cb();
  });
  process.on('error', _handleErr(cb));
}

function _execPre(cb) {
  if (_isExit() || _options.patch) return cb();
  _execAction(_settings.xpre, cb);
}

function _execPost(cb) {
  if (_isExit() || _options.patch) return cb();
  _execAction(_settings.xpost, cb);
}


// creates temporary path
function _createTempPath(cb) {
  if (_isExit()) return cb();
  _log(null, 'creates temporary path');
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
function _deleteTempPath(cb) {
  if (_isExit()) return cb();
  var temp = path.join(_root, INSTALL_HERE_FOLDER);
  if ((!_options.debug || _force_first) && fs.existsSync(temp)) {
    _log(null, 'remove temporary path');
    _force_first = false;
    rimraf(temp, _handleErr(cb));
  } else {
    _force_first = false;
    cb();
  }
}

// install package
function _install(cb) {
  if (_isExit()) return cb();
  _log(null, 'installing package...');
  var cmd = 'npm install ' + _package.getInstallName();
  var process = cp.exec(cmd, {cwd: _temp + '/'}, function (err, out) {
    if (err) _error = err;
    if (out) _log('install output:\n' + out);
    cb();
  });
  process.on('error', _handleErr(cb));
}

function _getRelativeFolder(f) {
  var folder = path.dirname(f);
  return folder.slice(_root.length+1);
}

// check the path
function _checkPathX(relfolder, skipCreation) {
  if (!relfolder) return;
  var parts = relfolder.split(path.sep);
  var checked = _root;
  var checkedParts = '';
  var index = 0;
  var skip =  false;
  do {
    checked = path.join(checked, parts[index]);
    if (!fs.existsSync(checked)) {
      if (!skipCreation) {
        fs.mkdirSync(checked);
        checkedParts = path.join(checkedParts, parts[index]);
      } else {
        skip = true;
      }
    } else {
      checkedParts = path.join(checkedParts, parts[index]);
    }
    index++;
  } while (!skip && index < parts.length);
  return checkedParts;
}

// check the file path
function _checkPath(f) {
  var relfolder = _getRelativeFolder(f);
  _checkPathX(relfolder);
}

// gestisce i file package.json
// riporta le dipendenze sul nuovo
function _managePkg(xdata, ndata) {
  try {
    var xpkg = JSON.parse(xdata);
    var npkg = JSON.parse(ndata);
    for (var dep in xpkg.dependencies) {
      if (!npkg.dependencies[dep])
        npkg.dependencies[dep] = xpkg.dependencies[dep];
    }
    for (var pn in npkg) {
      if (pn&&pn.indexOf('_')==0)
        delete npkg[pn];
    }
    ndata = JSON.stringify(npkg, null, 2);
  } catch(err){
    console.error(err);
  }
  return ndata;
}

// updates file
function _replacePkgFile(f) {
  var nf = f.replace(_relpath + path.sep, '');
  if (_settings._filters.ignore.check(nf))
    return _log('Skip file: '+nf);

  _checkPath(nf);

  var xdata = null;
  var ispkj = (path.basename(nf)==PACKAGE_CONFIG);
  if (ispkj && _options.patch)
    return _log('Skip overwriting file: '+nf);
  if (fs.existsSync(nf)) {
    if (_settings._filters.ignoreOverwrite.check(nf))
      return _log('Skip overwriting file: '+nf);
    if (ispkj && !_options.skipkg) xdata = fs.readFileSync(nf);
    //elimina il file originale
    fs.unlinkSync(nf);
  }
  _log('replace file: ' + nf);
  //legge il file
  var data = fs.readFileSync(f);
  if (ispkj && xdata) data = _managePkg(xdata, data);
  //scrive il nuovo file
  fs.writeFileSync(nf, data);
  _counters.files++;
}

function _replaceDepFile(f) {
  var nf = path.join(_root, path.join(NODE_MODULES_FOLDER, path.relative(_temp, f)));
  _checkPath(nf);
  if (fs.existsSync(nf)) {
    fs.unlinkSync(nf);
  }
  _log('replace dependency file: ' + nf);
  var data = fs.readFileSync(f);
  fs.writeFileSync(nf, data);
  _counters.dependencies++;
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

function _checkFileList(list) {
  _.remove(list, function (f) {
    var relfolder = _getRelativeFolder(f);
    var checkedParts = _checkPathX(relfolder);
    var skip = checkedParts &&
      _settings._filters.ignorePath.check(checkedParts) &&
      _settings._filters.ignorePath.check(relfolder);
    if (skip) {
      var nf = f.replace(_relpath + path.sep, '');
      _log('Skip writing file: ' + nf);
    }
    return skip;
  });
}

// updates files
function _replace(cb) {
  if (_isExit()) return cb();
  _log(null, 'updates package files');
  try {
    _allFiles(_files, path.join(_temp, _package.name));
    _checkFileList(_files);
    _files.forEach(_replacePkgFile);
    cb();
  } catch(err) {
    _handleErr(cb)(err);
  }
}

// updates dependencies
function _replaceDep(cb) {
  if (_isExit()) return cb();
  _log(null, 'updates dependencies files');
  try {
    _allFiles(_dependecies, path.join(_temp), path.join(_temp, _package.name));
    if (!_options.patch)
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
  .use(_checkInstallHere)
  .use(_checkOptions)
  .use(_checkPackage)
  .use(_retrievePackageVersion)
  .use(_checkVersion)
  .use(_checkTest)
  .use(_deleteTempPath)
  .use(_createTempPath)
  .use(_execPre)
  .use(_install)
  .use(_replace)
  .use(_replaceDep)
  .use(_deleteTempPath)
  .use(_saveSettings)
  .use(_execPost)
  .run(function() {
    if (_exit) {
      console.log.apply(null, _exit);
    } else if (_error) {
      if (_.isString(_error)) {
        console.error('\tERROR: '+_error);
      } else {
        throw _error;
      }
    } else {
      console.log('Done: \n\t%s v.%s\n\t%d package files updates\n\t%d dependencies files updates',
        _package.name, _package.version, _counters.files, _counters.dependencies);
    }
  });
