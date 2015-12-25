/* global describe, it, xit */
/* jslint node: true, esnext: true */

"use strict";

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  stm = require('../StateTransitionMixin');

const actions = stm.prepareActions({
  start: {
    stopped: {
      target: "running",
      during: "starting",
      timeout: 10
    }
  },
  stop: {
    running: {
      target: "stopped",
      during: "stopping",
      timeout: 5
    },
    starting: {
      target: "stopped",
      during: "stopping",
      timeout: 10
    }
  }
});

class BaseClass {}

class StatefullClass extends stm.StateTransitionMixin(BaseClass, actions, 'stopped') {
  _start() {
    return new Promise((f, r) => {
      setTimeout(() => {
        f(this)
      }, 10);
    });
  }
}

stm.defineActionMethods(StatefullClass.prototype, actions);

describe('states', function () {
  const o1 = new StatefullClass();

  it('has initial state', function () {
    assert.equal(o1.state, 'stopped');
  });

  it('can be started', function (done) {
    o1.start().then(() => {
      assert.equal(o1.state, 'running');
      done();
    }, done);
  });

  it('can be stopped', function (done) {
    o1.stop().then(() => {
      assert.equal(o1.state, 'stopped');
      done();
    }, done);
  });
});
