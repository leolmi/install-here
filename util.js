'use strict';
var _ = require('lodash');

function _getStep(c) {
  var step = c._step < c._stack.length ? c._stack[c._step] : null;
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
    var self = this;
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
    var self = this;
    self._step = 0;
    if (self._stack.length<=0) return cb();
    (function next() {
      var step = _getStep(self);
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

exports.compose = function(execFnName) { return new composer(execFnName); }