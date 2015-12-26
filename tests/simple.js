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

var shouldReject = false;

class StatefullClass extends stm.StateTransitionMixin(BaseClass, actions, 'stopped') {
  _start() {
    return new Promise((f, r) => {
      setTimeout(() => {
        if (shouldReject) {
          r(new Error("always reject"));
        } else {
          f(this);
        }
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

  it('has action methods', function () {
    assert.isDefined(o1.stop());
    assert.isDefined(o1.start());
    assert.isDefined(o1._start());
    assert.isDefined(o1._stop());
  });

  it('can be started', function (done) {
    o1.start().then(() => {
      assert.equal(o1.state, 'running');
      done();
    }, done);
  });

  it('and stoped', function (done) {
    o1.stop().then(() => {
      assert.equal(o1.state, 'stopped');
      done();
    }, done);
  });

  it('can be started while starting', function (done) {
    assert.equal(o1.state, 'stopped');

    o1.start().then(() => {});

    assert.equal(o1.state, 'starting');

    o1.start().then(() => {
      assert.equal(o1.state, 'running');
      done();
    }, done).catch(done);
  });

  xit('can be stopped while starting', function (done) {
    o1.stop().then(() => {
      assert.equal(o1.state, 'stopped');

      o1.start().then(() => {});

      assert.equal(o1.state, 'starting');

      o1.stop().then(() => {
        assert.equal(o1.state, 'stopped');
        done();
      }, done).catch(done);
    });
  });

  it('handle failure while starting', function (done) {
    o1.stop().then(() => {
      shouldReject = true;
      assert.equal(o1.state, 'stopped');
      o1.start().then(() => {}).catch(e => {
        assert.equal(o1.state, 'failed');
        done();
      });
    });
  });
});
