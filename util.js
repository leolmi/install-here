'use strict';
const _ = require('lodash');
const path = require('path');


function _getStep(c) {
  const step = c._step < c._stack.length ? c._stack[c._step] : null;
  c._step++;
  return step;
}

var composer = function(execFnName) {
  this._exec = execFnName || 'exec';
  this._stack = [];
};

composer.prototype = {
  /**
   * Aggiunge un elemento in stack
   * @param {function|object} step
   * @returns {composer}
   */
  use: function(step) {
    const self = this;
    self._stack.push(step);
    return self;
  },
  /**
   * Avvia lo stack di elementi
   * @param {function} [cb]
   * @returns {*}
   */
  run: function(cb) {
    cb = cb || _.noop;
    const self = this;
    self._step = 0;
    if (self._stack.length<=0) return cb();
    (function next() {
      const step = _getStep(self);
      if (!step) {
        cb();
      } else if (_.isFunction(step)) {
        step.call(self, next);
      } else if (_.isFunction(step[self._exec])) {
        step[self._exec](next);
      }
    })();
  }
};

exports.compose = function(execFnName) { return new composer(execFnName); };

function _replace(s, f, r) {
  const rgx = new RegExp(f, 'g');
  return s.replace(rgx, r);
}

function _replaseRgxParts(s) {
  s = s.replace(/\[s\]/g, '\\' + path.sep);
  s = s.replace(/\[p\]/g, '\\.');
  s = s.replace(/\[0\]/g, '(.*)');
  s = s.replace(/\[3\]/g, '[^\\' + path.sep + ']*\\.[^\\' + path.sep + ']*');
  s = s.replace(/\[4\]/g, '[^\\' + path.sep + ']*\\.');
  s = s.replace(/\[5\]/g, '\\.[^\\' + path.sep + ']*');
  s = s.replace(/\[6\]/g, '[^\\' + path.sep + ']*');
  return s;
}

function _buildFilter(fi) {
  if (!fi.str) return;
  var f = path.normalize(fi.str);
  // \  >> \\
  f = _replace(f, '\\'+path.sep, '[s]');
  // .  >>  \.
  f = _replace(f, '\\.', '[p]');
  //  ^* | **\* | **  >>   (.*)
  f = _replace(f,'^\\*|\\*\\*\\[s]\\*|\\*\\*','[0]');
  //  *.*  >>   [^\\sep]*\.[^\\sep]*
  f = _replace(f,'\\*[p]\\*','[3]');
  //  *.  >>   [^\\sep]*\.
  f = _replace(f,'\\*[p]','[4]');
  //  .*  >>   \.[^\\sep]*
  f = _replace(f,'[p]\\*','[5]');
  //  *    >>   [^\\sep]*
  f = _replace(f,'\\*','[6]');
  //  ^*
  if (!_.startsWith(f, '[0]')) f='[0]'+f;
  fi._model = f;
  f = _replaseRgxParts(f);
  fi._filter = f;
  fi.rgx = new RegExp(f);
}

var PathFilterItem = function(f) {
  this.rgx = null;
  this.str = f;
  _buildFilter(this);
};
PathFilterItem.prototype = {
  check: function(fn) {
    return this.rgx ? this.rgx.test(fn) : false;
  }
};
exports.getPathFilterItem = function(filter) { return new PathFilterItem(filter); };

var PathFilter = function(filter, defaults) {
  filter = filter || '';
  if (defaults) filter += ';' + defaults;
  this.str = filter;
  this.items = _.map((filter||'').split(';'), function(f){
    return new PathFilterItem(f);
  });
};
PathFilter.prototype = {
  check: function(fn) {
    if (this.items.length<=0) return false;
    return _.find(this.items, function(i){
      return i.check(fn);
    });
  }
};

exports.logi = function(m) {
  process.stdout.write(m);
};


exports.getPathFilters = function(filter, defaults) { return new PathFilter(filter, defaults); };

exports.version = function (v) {
  return ''+(v.match(/\d+\.\d+\.\d+.*/g)||'');
};

exports.sanitize = function(o) {
  for (var pn in o) {
    if (pn && pn.indexOf('_')===0)
      delete o[pn];
  }
};