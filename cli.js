#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var cp = require('child_process');
var u = require('./util.js');
var rimraf = require('rimraf');

var INSTALL_HERE_FOLDER = '.install-here';
var NODE_MODULES_FOLDER = 'node_modules';

// npm install-here package path
var _package = process.argv[2];
var _target = process.argv[3];
var _error = null;
var _temp = '';
var _root = process.cwd();
var _files = [];
var _relpath = path.join(INSTALL_HERE_FOLDER,NODE_MODULES_FOLDER,_package);
var _settings = {};

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
  if (fs.existsSync('./install-here.json')) _settings = require('./install-here.json')||{};

  console.log('package: %s,  target: %s', _package, _target);
  cb();
}

// crea il path temporaneo dove installare i file
function _createTempPath(cb) {
  if (_error) cb();
  console.log('crea il path temporaneo dove installare i file');

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

// elimina il path temporaneo
function _deleteTemp(cb) {
  console.log('elimina il path temporaneo');
  if (_error) cb();
  var temp = path.join(_root, INSTALL_HERE_FOLDER);
  rimraf(temp, _handleErr(cb));
}

// installa il pacchetto
// temp + ./node_modules/{package}
function _install(cb) {
  console.log('installa il pacchetto');
  if (_error) cb();
  var process = cp.exec('npm install '+_package,{cwd: _temp+'/'}, function(err, out, stderr){
    if (err) _error = err;
    if (out) console.log('Install output:\n'+out)
    cb();
  });
  process.on('error', _handleErr(cb));
}

// Verifica l'esistenza di ogni directory che costituisce il path
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

// verifica il path del file
function _checkPath(f) {
  var folder = path.dirname(f);
  var relfolder = folder.slice(_root.length+1);
  console.log('CHECK PATH:  folder="' + folder + '"    relfolder="'+relfolder+'"');
  console.log('RELATIVE FOLDER: ' + f + '\n\t  >>>> "' + relfolder + '"');
  if (relfolder)
    _checkPathX(relfolder)
}

// verifica dai settings se il file è da escludere
function _ignore(f) {
  var ignore = (_settings.ignore || '').split(';');
  var info = path.parse(f);
  return ignore.indexOf('*' + info.ext) > -1 ||
    ignore.indexOf(info.base) > -1;
}

// aggiorna il singolo file
function _replaceFile(f) {
  if (_error) return;
  var nf = f.replace(_relpath + path.sep, '');
  if (_ignore(nf)) {
    console.log('Skip file: '+nf);
    return;
  }
  console.log('replace del file: ' + nf + '\t >> ' + f);

  //verifica il path del file
  _checkPath(nf);

  if (fs.existsSync(nf)) {
    fs.unlinkSync();
  }
  var data = fs.readFileSync(f);
  fs.writeFileSync(nf, data);
}

function _allFiles(list, folder) {
  fs.readdirSync(folder).forEach(function(f) {
    var fn = path.join(folder, f);
    if (fs.statSync(fn).isDirectory()) {
      _allFiles(list, fn);
    } else {
      list.push(fn);
    }
  });
}

// effettua il replace dei file con quelli presenti
function _replace(cb) {
  console.log('effettua il replace dei file con quelli presenti');
  if (_error) cb();
  try {
    _allFiles(_files, path.join(_temp, _package));
    _files.forEach(_replaceFile);
    cb();
  } catch(err) {
    _handleErr(cb)(err);
  }
}


u.compose()
  .use(_init)
  .use(_deleteTemp)
  .use(_createTempPath)
  .use(_install)
  .use(_replace)
  .use(_deleteTemp)
  .run(function() {
    if (_error) {
      console.log('Terminato con errori');
      throw _error;
    } else {
      console.log('Done %d files updates.', _files.length)
    }
  });
