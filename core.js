'use strict';

const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const _ = require('lodash');
const u = require('./util.js');
const rimraf = require('rimraf');
const info = require('./package.json');
const tar = require('tar');

const _constants = {
  INSTALL_HERE_FOLDER: '.install-here',
  NODE_MODULES_FOLDER: 'node_modules',
  INSTALL_HERE_CONFIG: 'install-here.json',
  PACKAGE_CONFIG: 'package.json',
  CHANGE_LOG: 'changelog.md',
  GIT_IGNORE_FILE: '.gitignore',
  GIT_IGNORE: 'node_modules\npublic\n.tmp\n.sass-cache\n.idea\n.install-here\ndist'
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
      var npkg = JSON.parse(ndata||'{}');
      var xpkg = xdata?JSON.parse(xdata):JSON.parse(ndata||'{}');
      _managePkg(npkg, xpkg);
      _initPkg(xpkg);
      xdata = JSON.stringify(xpkg, null, 2);
      _log('package.json managed: %s', xdata);
    } catch(err){
      console.error(err);
    }
    return xdata;
  }
};

exports.state = _state;

function _initPkg(pkg) {
  pkg.name = _state.package.name||'MY-PROJECT-NAME';
  pkg.version = _state.package.version||'0.0.0';
  pkg.license = _state.package.license||'';
  pkg.author = _state.package.author||'';
  pkg.url = _state.package.url||'';
  pkg.email = _state.package.email||'';
  pkg.keywords = _state.package.keywords||[];
}

// adds/overrite with source dependencies
function _managePkgDeps(spkg, tpkg, deps, check) {
  deps = deps||'dependencies';
  const source = spkg[deps]||{};
  const target = tpkg[deps]||{};
  _.keys(source).forEach(function(dep){
    if (!!check && !target[dep]) _state.counters.depAddUpd++;
    target[dep] = source[dep];
  });
}

function _managePkg(spkg, tpkg) {
  _managePkgDeps(spkg, tpkg);
  _managePkgDeps(spkg, tpkg, 'devDependencies', true);
  u.sanitize(tpkg);
}

exports.managePkg = _managePkg;


function _handleErr(cb, skip) {
  return function(err) {
    if (err) {
      skip ? _state.error = err : console.error(err);
    }
    cb();
  }
}

function _log() {
  if (_state.options.verbose || _state.options.debug) {
    const args = Array.prototype.slice.call(arguments);
    if (args.length > 0 && args[0])
      console.log.apply(null, args);
  }
}

function _getInfo(name) {
  var parts = (name||'').split('@');
  return {
    fullName: name||'',
    name: parts[0],
    version: (parts.length > 1) ? parts[1] : ''
  }
}

function _getRootJson(name) {
  const json_path = path.join(_state.root, name);
  return (fs.existsSync(json_path)) ? require(json_path) : null;
}

var Settings = function() {
  var self = this;
  self.name = '';
  self.version = '';
  self.ignore = '';
  self.ignoreOverwrite = '';
  self.ignorePath = '';
  self.checkVersion = true;
  self._local = _getRootJson(_state.config);
  _.extend(self, self._local||{});
  self._version = self.version;
  self._filters = {
    ignore: u.getPathFilters(self.ignore),
    ignoreOverwrite: u.getPathFilters(self.ignoreOverwrite, _state.config),
    ignorePath: u.getPathFilters(self.ignorePath)
  };
  self.xpre = self.xpre || (_state.options||{}).xpre;
  self.xpost = self.xpost || (_state.options||{}).xpost;
};
Settings.prototype = {
  keepVersion: function(v) {
    this._version = this.version;
    this.version = u.version(v);
  },
  getInstallName: function() {
    return this.name+'@'+this.version;
  },
  checkRemote: function() {
    var self = this;
    _log('remote config content: %s', (self._remote?JSON.stringify(self._remote):'empty'));
    if (!self._local && self._remote) _.extend(self, self._remote)
    _log('remote package content: %s', (self._remotePkg?JSON.stringify(self._remotePkg):'empty'));
    if (self._remotePkg) {
      self.name = self.name||self._remotePkg.name;
      self.version = self._remotePkg.version;
    }
  }
};



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
      skipgit: !!a.skipgit,
      help: !!(a.h || a.help),
      xpre: a.xpre,
      xpost: a.xpost,
      patch: !!a.patch,
      pack: !!(a.p || a.pack)
    };
    _state.package = _getRootJson(_constants.PACKAGE_CONFIG)||{};
    _state.info = _getInfo((a._.length > 0) ? a._[0] : null);
    _state.settings = new Settings();
    _log('settings: %s', JSON.stringify(_state.settings));
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
      '\t\t--pack,-p:\tinstall pack without dependencies\n'+
      '\t\t--skipkg:\tskip package.json check\n'+
      '\t\t--skipgit:\tskip .gitignore check\n'+
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
  // name and version will be the package ones if undefined
  _state.settings.name = _state.settings.name || _state.package.name;
  _state.settings.version = _state.settings.version || _state.package.version;

  _log('check settings: %s', JSON.stringify(_state.settings));

  if (!_state.info.name) {
    // se non viene passato il nome esplicitamente ed è
    // una patch segnala l'errore
    if (_state.options.patch) {
      _state.error = 'Undefined patch name!';
    }
  } else if (_state.settings.name && !_state.options.patch) {
    // se il nome del package è stato passato ed esiste già
    // una definizione e non è una patch
    if (_state.info.name == _state.settings.name) {
      _state.settings.keepVersion(_state.info.version);
    } else {
      _state.error = 'Other package not allowed (current: "' + _state.settings.name +
        '")\n\tuse --patch option to merging with other package!';
    }
  } else if (!_state.settings.name && _state.options.patch) {
    // se non esiste definizione ed è una patch
    _state.error = 'Nothing to patch!\n\tinstall base package before.';
  } else {
    _state.settings.name = _state.info.name;
    _state.settings.keepVersion(_state.info.version);
  }
  if (_state.isExit()) return cb();

  if (!_state.settings.name) {
    _state.error = 'Undefined package!\n\tuse: ' + info.name + ' <package> [<options>]';
  } else {
    _state.relpath = path.join(_constants.INSTALL_HERE_FOLDER, _constants.NODE_MODULES_FOLDER, _state.settings.name);
    // console.log('package: %s   >  target: %s', _state.package.name, _state.options.target || 'current directory');
  }
  _log('settings: %s', JSON.stringify(_state.settings));
  cb();
};

// retrieve remote package version
exports.retrievePackageVersion = function(cb) {
  if (_state.isExit()) return cb();
  var patch = _state.options.patch?' as patch':'';
  if (!_state.info.version) {
    var cmd = 'npm view ' + _state.settings.name + ' version -g';
    _log('Try to retrieve version: %s', cmd);
    cp.exec(cmd, function (err, out) {
      if (out) {
        _state.settings.version = u.version(out.trim());
        console.log('found %s v.%s %s', _state.settings.name, _state.settings.version, patch);
      }
      if (err && _state.options.debug)
        console.error(err);
      cb();
    });
  } else {
    console.log('installing %s v.%s %s', _state.settings.name, _state.settings.version, patch);
    cb();
  }
};

// check the package version
exports.checkVersion = function(cb) {
  if (_state.isExit() || (!_state.options.patch && (_state.options.force || !_state.settings.checkVersion))) return cb();
  if (_state.settings.version && !_state.options.patch) {
    if (_state.settings.version == _state.settings._version) {
      _state.exit = ['package "%s" is up-to-date.', _state.settings.name];
    } else if (_state.settings._version) {
      console.log('current %s v.%s', _state.settings.name, _state.settings._version);
    }
  }
  if (!_state.settings.version) {
    _state.error = 'Package version not found!';
  }
  cb();
};

exports.checkTest = function(cb) {
  if (_state.isExit()) return cb();
  if (_state.options.test) _state.exit = ['test finished.'];
  cb();
};

function _execAction(cmd, cb, skipErr) {
  if (_state.isExit() || !cmd) return cb();
  console.log('exec script: %s', cmd);
  const process = cp.exec(cmd, {cwd: _state.root + '/'}, function (err, out) {
    if (err) {skipErr ? console.error(err) : _state.error = err;}
    if (out) _log('action output:\n%s', out);
    cb();
  });
  process.on('error', _handleErr(cb, skipErr));
}

exports.execPre = function(cb) {
  if (_state.isExit() || _state.options.patch) return cb();
  _execAction(_state.settings.xpre, cb);
};

exports.execPost = function(cb) {
  if (_state.isExit() || _state.options.patch) return cb();
  _state.settings._local ? _execAction(_state.settings.xpost, cb, true) : cb();
};


// creates temporary path
exports.createTempPath = function(cb) {
  if (_state.isExit()) return cb();
  console.log('creates temporary path');
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
  var temp = path.join(_state.root, _constants.INSTALL_HERE_FOLDER);
  if ((!_state.options.debug || _state.force_first) && fs.existsSync(temp)) {
    console.log('remove temporary path');
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
  _log('pre install settings: %s', JSON.stringify(_state.settings, null, 2));
  console.log('installing package...');
  const verb = _state.options.pack ? 'pack' : 'install';
  const cmd = 'npm ' + verb + ' ' + _state.settings.getInstallName();
  _log('installing package: %s', cmd);
  var process = cp.exec(cmd, {cwd: _state.temp + '/'}, function (err, out) {
    if (err) _state.error = err;
    if (out) _log('install output:\n%s', out);
    if (_state.options.pack) {
      _log('extract package: %s', out);
      const pack = path.join(_state.temp, (out || '').trim());
      const targetp = path.join(_state.temp, _state.settings.name);
      tar.extract({
        file: pack,
        cwd: _state.temp
      }).then(function() {
        fs.unlinkSync(pack);
        const sourcep = path.join(_state.temp, 'package');
        _log('rename target folder: %s > %s', sourcep, targetp);
        fs.rename(sourcep, targetp, function(err) {
          if (err) _state.error = err;
          _log('installed.');
          cb();
        });
      }, _handleErr(cb));
    } else {
      _log('installed.');
      cb();
    }
  });
  process.on('error', _handleErr(cb));
};

exports.checkConfig = function(cb) {
  if (_state.isExit()) return cb();
  const fn_config = path.join(_state.temp, _state.settings.name, _state.config);
  _log('remote config: %s', fn_config);
  _state.settings._remote = fs.existsSync(fn_config) ? require(fn_config) : null;
  const fn_package = path.join(_state.temp, _state.settings.name, _constants.PACKAGE_CONFIG);
  _state.settings._remotePkg = fs.existsSync(fn_package) ? require(fn_package) : null;
  _state.settings.checkRemote();
  _log('check config settings: %s', JSON.stringify(_state.settings));
  cb();
};

// remove deprecate files & paths
exports.delete = function(cb) {
  if (_state.isExit()) return cb();
  if (_state.settings._remote) {
    if (_.isString(_state.settings._remote.delete)) {
      console.log('deleting deprecated...');
      _state.settings._remote.delete.split(';').forEach(function(fp){
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
  const nf = f.replace(_state.relpath + path.sep, '');
  if (_state.settings._filters.ignore.check(nf))
    return _log('Skip file: %s', nf);

  _checkPath(nf);

  var xdata = null;
  const ispkj = (path.basename(nf) == _constants.PACKAGE_CONFIG);
  if (ispkj && _state.options.patch)
    return _log('Skip overwriting file: %s', nf);
  const exists = fs.existsSync(nf);
  if (exists) {
    if (_state.settings._filters.ignoreOverwrite.check(nf))
      return _log('Skip overwriting file: %s', nf);
    if (ispkj && !_state.options.skipkg) xdata = fs.readFileSync(nf);
  }
  // legge il file
  var data = fs.readFileSync(f);
  if (ispkj) {
    data = _state.managePkg(xdata, data);
  } else if (_.isFunction(_state.manageFile)) {
    data = _state.manageFile(data, nf, exists);
  }

  if (!data) return _log('Skip file: %s', nf);

  _log('replace file: %s', nf);
  //elimina il file originale se esiste
  if (exists) fs.unlinkSync(nf);
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
  _log('replace dependency file: %s', nf);
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
      _log('Skip writing file: %s', nf);
    }
    return skip;
  });
}

// updates files
exports.replace = function(cb) {
  if (_state.isExit()) return cb();
  console.log('updates package files');
  try {
    _allFiles(_state.files, path.join(_state.temp, _state.settings.name));
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
  console.log('updates dependencies files');
  try {
    _allFiles(_state.dependecies, path.join(_state.temp), path.join(_state.temp, _state.settings.name));
    if (!_state.options.patch)
      _state.dependecies.forEach(_replaceDepFile);
    cb();
  } catch(err) {
    _handleErr(cb)(err);
  }
};

exports.checkGitIgnore = function(cb){
  if (_state.isExit()) return cb();
  var gtipath = path.join(_state.root, _constants.GIT_IGNORE_FILE);
  if (!fs.existsSync(gtipath) && _state.options.skipgit!==true) {
    fs.writeFileSync(gtipath, _constants.GIT_IGNORE);
  }
  cb();
};

exports.saveSettings = function(cb) {
  if (_state.isExit()) return cb();
  var cnfpath = path.join(_state.root, _state.config);
  _log('save settings: %s', cnfpath);
  var sc = _.clone(_state.settings);
  u.sanitize(sc);
  var data = JSON.stringify(sc, null, 2);
  fs.writeFileSync(cnfpath, data);
  _log('settings saved');
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
      _state.settings.name, _state.settings.version, _state.counters.files, _state.counters.dependencies);
    if (_state.counters.depAddUpd>0)
      console.warn('Dependencies are changed (%d), use "npm install" to update the project!', _state.counters.depAddUpd);
  }
};