'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const _ = require('lodash');
const u = require('./util.js');
const rimraf = require('rimraf');
const info = require('./package.json');

const _constants = {
  INSTALL_HERE_FOLDER: '.install-here',
  NODE_MODULES_FOLDER: 'node_modules',
  INSTALL_HERE_CONFIG: 'install-here.json',
  PACKAGE_CONFIG: 'package.json',
  CHANGE_LOG: 'changelog.md'
};

exports.constants = _constants;

const _state = {
  config: _constants.INSTALL_HERE_CONFIG,
  // opzioni di esecuzione
  options: {},
  // root di esecuzione
  root: '',
  // path temporanea di installazione moduli
  temp: '',
  // elenco dipendenze
  dependecies: [],
  // elenco file processati
  files: [],
  // argomento d'uscita
  exit: null,
  // errori
  error: null,
  // contatori
  counters: null,
  // package
  package: null,
  // impostazioni
  settings: null,
  // path relativo
  relpath: '',
  // permette di eliminare il folder temporaneo
  force_first: true,
  // resetta lo stato
  reset: function() {
    this.config = _constants.INSTALL_HERE_CONFIG;
    this.force_first = true;
    this.relpath = '';
    this.root = process.cwd();
    this.counters = {
      files: 0,
      dependencies: 0,
      depAddUpd: 0
    };
    this.error = null;
    this.exit = null;
    this.temp = '';
    this.files = [];
    this.dependecies = [];
    this.package = null;
    this.settings = null;
    this.options = null;
  },
  isExit: function() {
    return this.exit||this.error;
  },
  // gestisce le modifiche al package.json
  managePkg: function(xdata, ndata) {
    try {
      var xpkg = JSON.parse(xdata);
      var npkg = JSON.parse(ndata);
      _managePkg(xpkg, npkg);
      ndata = JSON.stringify(npkg, null, 2);
    } catch(err){
      console.error(err);
    }
    return ndata;
  }
};

exports.state = _state;

function _managePkgDeps(spkg, tpkg, deps, check) {
  const source = spkg[deps]||{};
  const target = tpkg[deps]||{};
  _.keys(source).forEach(function(dep){
    if (!!check && target[dep] != source[dep]) _state.counters.depAddUpd++;
    target[dep] = source[dep];
  });
}

function _managePkg(spkg, tpkg) {
  _managePkgDeps(spkg, tpkg, 'dependencies');
  _managePkgDeps(spkg, tpkg, 'devDependencies', true);
  u.sanitize(tpkg);
}

exports.managePkg = _managePkg;

var Settings = function(s) {
  this.ignore = '';
  this.ignoreOverwrite = '';
  this.ignorePath = '';
  this.checkVersion = true;
  if (s) _.extend(this, s);
  var self = this;
  this._filters = {
    ignore: u.getPathFilters(self.ignore),
    ignoreOverwrite: u.getPathFilters(self.ignoreOverwrite, _state.config),
    ignorePath: u.getPathFilters(self.ignorePath)
  };
  this.xpre = this.xpre || (_state.options||{}).xpre;
  this.xpost = this.xpost || (_state.options||{}).xpost;
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

function _handleErr(cb) {
  return function(err) {
    if (err) _state.error = err;
    cb();
  }
}

function _log(m, m1) {
  if (_state.options.verbose||_state.options.debug) {
    console.log(m);
  } else if (m1) {
    console.log(m1);
  }
}

exports.log = _log;

exports.init = function(a) {
  return function (cb) {
    _state.reset();
    _state.config = a.config||_state.config;
    _state.options = {
      version: a.v || a.version || a.ver,
      history: a.vh || a.verhist,
      force: a.f || a.force,
      verbose: a.verbose,
      debug: a.d || a.debug,
      test: a.t || a.test,
      skipkg: !!a.skipkg,
      help: !!a.h || a.help,
      xpre: a.xpre,
      xpost: a.xpost,
      patch: !!a.patch,
      target: '' //a.target
    };
    var name = (a._.length > 0) ? a._[0] : null;
    _state.package = new Package(name);
    var cnfpath = path.join(_state.root, _state.config);
    var s = (fs.existsSync(cnfpath)) ? require(cnfpath) || {} : {};
    _state.settings = new Settings(s);
    _log('settings: ' + JSON.stringify(_state.settings));
    (cb||_.noop)();
  }
};

exports.checkInstallHere = function(cb) {
  //TODO: check the install-here version
  cb();
};

exports.checkOptions = function(cb) {
  if (_state.options.help) {
    var help ='\t'+info.name+' [<package>] [<options>]\n\n'+
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
    _state.exit = ['%s v.%s\n%s', info.name, info.version, help];
  } else if (_state.options.version) {
    var v = u.version(info.version);
    var rgx =  new RegExp('## '+v+'[\n]*([^#]*)', 'g');
    var logfile = path.join(__dirname, _constants.CHANGE_LOG);
    var log = (fs.existsSync(logfile)) ? fs.readFileSync(logfile) : '';
    var m = rgx.exec(log);
    var cnglog = _state.options.verbose ? log : (m?m[1]:'');
    _state.exit = ['%s v.%s \n\n%s', info.name, info.version, cnglog];
  } else if (_state.options.history) {
    var histfile = path.join(__dirname, _constants.CHANGE_LOG);
    var hist = (fs.existsSync(histfile)) ? fs.readFileSync(histfile) : '';
    _state.exit = ['%s version history:\n', info.name, hist.toString()];
  } else {
    console.log('%s v.%s', info.name, info.version);
  }
  cb();
};

// check the package name
exports.checkPackage = function(cb) {
  if (_state.isExit()) return cb();
  var pkgroot = path.join(_state.root, _state.options.target, _constants.PACKAGE_CONFIG);
  var pkg = (fs.existsSync(pkgroot)) ? require(pkgroot) : null;
  if (!_state.package.name) {
    // se non viene passato il nome esplicitamente e non è una patch
    // si aspetta di aggiornare il package esistente
    if (!_state.options.patch && pkg) {
      _state.package.name = pkg.name;
      _state.package.xversion = u.version(pkg.version);
    }
  } else if (pkg && !_state.options.patch) {
    // se il nome del package è stato passato ed esiste già
    // una definizione e non è una patch
    if (pkg.name == _state.package.name) {
      _state.package.xversion = u.version(pkg.version);
    } else {
      _state.error = 'Other package not allowed (current: "' + pkg.name +
        '")\n\tuse --patch option to merging with other package!';
    }
  } else if (!pkg && _state.options.patch) {
    // se non esiste definizione ed è una patch
    _state.error = 'Nothing to patch!\n\tinstall base package before.';
  }
  if (_state.isExit()) return cb();

  if (!_state.package.name) {
    _state.error = 'Undefined package!\n\tuse: '+info.name+' <package> [<options>]';
  } else {
    _state.relpath = path.join(_constants.INSTALL_HERE_FOLDER, _constants.NODE_MODULES_FOLDER, _state.package.name);
    // console.log('package: %s   >  target: %s', _state.package.name, _state.options.target || 'current directory');
  }
  if (_state.options.debug) _log(null, 'package: '+JSON.stringify(_state.package));
  cb();
};

// retrieve remote package version
exports.retrievePackageVersion = function(cb) {
  if (_state.isExit()) return cb();
  var patch = _state.options.patch?' as patch':'';
  if (!_state.package.version) {
    var cmd = 'npm view ' + _state.package.name + ' version -g';
    if (_state.options.debug) console.log('Try to retrieve version: "%s"', cmd);
    cp.exec(cmd, function (err, out) {
      if (out) {
        _state.package.version = out.trim();
        console.log('found %s v.%s %s', _state.package.name, _state.package.version, patch);
      }
      if (err && _state.options.debug)
        console.error(err);
      cb();
    });
  } else {
    console.log('installing %s v.%s %s', _state.package.name, _state.package.version, patch);
    cb();
  }
};

// check the package version
exports.checkVersion = function(cb) {
  if (_state.isExit() || (!_state.options.patch && (_state.options.force || !_state.settings.checkVersion))) return cb();
  if (_state.package.version && !_state.options.patch) {
    if (_state.package.version == _state.package.xversion) {
      _state.exit = ['package "%s" is up-to-date.', _state.package.name];
    } else if (_state.package.xversion) {
      console.log('current %s v.%s', _state.package.name, _state.package.xversion);
    }
  }
  if (!_state.package.version) {
    _state.error = 'Package version not found!';
  }
  cb();
};

exports.checkTest = function(cb) {
  if (_state.isExit()) return cb();
  if (_state.options.test) _state.exit = ['test finished.'];
  cb();
};

function _execAction(cmd, cb) {
  if (_state.isExit() || !cmd) return cb();
  _log(null, 'exec script: '+cmd);
  var process = cp.exec(cmd, {cwd: _state.root + '/'}, function (err, out) {
    if (err) _state.error = err;
    if (out) _log('action output:\n' + out);
    cb();
  });
  process.on('error', _handleErr(cb));
}

exports.execPre = function(cb) {
  if (_state.isExit() || _state.options.patch) return cb();
  _execAction(_state.settings.xpre, cb);
};

exports.execPost = function(cb) {
  if (_state.isExit() || _state.options.patch) return cb();
  _execAction(_state.settings.xpost, cb);
};


// creates temporary path
exports.createTempPath = function(cb) {
  if (_state.isExit()) return cb();
  _log(null, 'creates temporary path');
  var temp = path.join(_state.root, _constants.INSTALL_HERE_FOLDER);
  fs.mkdir(temp, function(err){
    if (err) {
      _state.error = err;
      cb();
    } else {
      _state.temp = path.join(temp, _constants.NODE_MODULES_FOLDER);
      fs.mkdir(_state.temp, _handleErr(cb));
    }
  });
};

// remove temporary path
exports.deleteTempPath = function(cb) {
  if (_state.isExit()) return cb();
  var temp = path.join(_state.root, _constants.INSTALL_HERE_FOLDER);
  if ((!_state.options.debug || _state.force_first) && fs.existsSync(temp)) {
    _log(null, 'remove temporary path');
    _state.force_first = false;
    rimraf(temp, _handleErr(cb));
  } else {
    _state.force_first = false;
    cb();
  }
};

// install package
exports.install = function(cb) {
  if (_state.isExit()) return cb();
  _log(null, 'installing package...');
  const cmd = 'npm install ' + _state.package.getInstallName();
  var process = cp.exec(cmd, {cwd: _state.temp + '/'}, function (err, out) {
    if (err) _state.error = err;
    if (out) _log('install output:\n' + out);
    cb();
  });
  process.on('error', _handleErr(cb));
};

// remove deprecate files & paths
exports.delete = function(cb) {
  const name = _state.package.getInstallName();
  const fn_config = path.join(_state.temp, name, _state.config);
  if (fs.existsSync(fn_config)) {
    var config = require(fn_config);
    if (_.isString(config.delete)) {
      _log(null, 'deleting deprecated...');
      config.delete.split(';').forEach(function(fp){
        var pn = path.join(_state.root, fp);
        if (fs.existsSync(pn)) {
          var stat = fs.statSync(pn);
          if (stat.isDirectory()) {
            rimraf(pn, _handleErr(cb));
          } else {
            fs.unlinkSync(pn);
          }
        }
      });
    }
  }
  cb();
};

function _getRelativeFolder(f) {
  var folder = path.dirname(f);
  return folder.slice(_state.root.length+1);
}

// check the path
function _checkPathX(relfolder, skipCreation) {
  if (!relfolder) return;
  var parts = relfolder.split(path.sep);
  var checked = _state.root;
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


// updates file
function _replacePkgFile(f) {
  var nf = f.replace(_state.relpath + path.sep, '');
  if (_state.settings._filters.ignore.check(nf))
    return _log('Skip file: '+nf);

  _checkPath(nf);

  var xdata = null;
  var ispkj = (path.basename(nf)==_constants.PACKAGE_CONFIG);
  if (ispkj && _state.options.patch)
    return _log('Skip overwriting file: '+nf);
  if (fs.existsSync(nf)) {
    if (_state.settings._filters.ignoreOverwrite.check(nf))
      return _log('Skip overwriting file: '+nf);
    if (ispkj && !_state.options.skipkg) xdata = fs.readFileSync(nf);
    //elimina il file originale
    fs.unlinkSync(nf);
  }
  _log('replace file: ' + nf);
  //legge il file
  var data = fs.readFileSync(f);
  if (ispkj && xdata) {
    data = _state.managePkg(xdata, data);
  } else if (_.isFunction(_state.manageFile)) {
    data = _state.manageFile(data, nf);
  }
  //scrive il nuovo file
  fs.writeFileSync(nf, data);
  _state.counters.files++;
}

function _replaceDepFile(f) {
  var nf = path.join(_state.root, path.join(_constants.NODE_MODULES_FOLDER, path.relative(_state.temp, f)));
  _checkPath(nf);
  if (fs.existsSync(nf)) {
    fs.unlinkSync(nf);
  }
  _log('replace dependency file: ' + nf);
  var data = fs.readFileSync(f);
  fs.writeFileSync(nf, data);
  _state.counters.dependencies++;
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
      _state.settings._filters.ignorePath.check(checkedParts) &&
      _state.settings._filters.ignorePath.check(relfolder);
    if (skip) {
      var nf = f.replace(_state.relpath + path.sep, '');
      _log('Skip writing file: ' + nf);
    }
    return skip;
  });
}

// updates files
exports.replace = function(cb) {
  if (_state.isExit()) return cb();
  _log(null, 'updates package files');
  try {
    _allFiles(_state.files, path.join(_state.temp, _state.package.name));
    _checkFileList(_state.files);
    _state.files.forEach(_replacePkgFile);
    cb();
  } catch(err) {
    _handleErr(cb)(err);
  }
};

// updates dependencies
exports.replaceDep = function(cb) {
  if (_state.isExit()) return cb();
  _log(null, 'updates dependencies files');
  try {
    _allFiles(_state.dependecies, path.join(_state.temp), path.join(_state.temp, _state.package.name));
    if (!_state.options.patch)
      _state.dependecies.forEach(_replaceDepFile);
    cb();
  } catch(err) {
    _handleErr(cb)(err);
  }
};

exports.saveSettings = function(cb) {
  var cnfpath = path.join(_state.root, _state.config);
  if (!fs.existsSync(cnfpath)) {
    var ser = _.clone(_state.settings);
    delete ser._filters;
    var data = JSON.stringify(ser, null, 2);
    fs.writeFileSync(cnfpath, data);
  }
  cb();
};

exports.report = function() {
  if (_state.exit) {
    console.log.apply(null, _state.exit);
  } else if (_state.error) {
    if (_.isString(_state.error)) {
      console.error('\tERROR: '+_state.error);
    } else {
      throw _state.error;
    }
  } else {
    console.log('Done: \n\t%s v.%s\n\t%d package files updates\n\t%d dependencies files updates',
      _state.package.name, _state.package.version, _state.counters.files, _state.counters.dependencies);
    if (_state.counters.depAddUpd>0)
      console.warn('Dependencies are changed (%d), use "npm install" to update the project!', _state.counters.depAddUpd);
  }
};