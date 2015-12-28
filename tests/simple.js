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
      timeout: 200
    }
  },
  stop: {
    running: {
      target: "stopped",
      during: "stopping",
      timeout: 100
    },
    starting: {
      target: "stopped",
      during: "stopping",
      timeout: 100
    }
  }
});

class BaseClass {}

class StatefullClass extends stm.StateTransitionMixin(BaseClass, actions, 'stopped') {
  constructor(startTime, shouldReject) {
    super();
    this.startTime = startTime;
    this.shouldReject = shouldReject;
  }
  _start() {
    return new Promise((f, r) => {
      setTimeout(() => {
        if (this.shouldReject) {
          r(new Error("always reject"));
        } else {
          f(this);
        }
      }, this.startTime);
    });
  }

  toString() {
    return `sample: ${this.state}`
  }
}

stm.defineActionMethods(StatefullClass.prototype, actions);

describe('states', function () {
  describe('static', function () {
    const o = new StatefullClass(10, false);

    it('has initial state', function () {
      o.state = 'stopped';
      assert.equal(o.state, 'stopped');
    });

    it('has action methods', function () {
      assert.isDefined(o.stop());
      assert.isDefined(o.start());
      assert.isDefined(o._start());
      assert.isDefined(o._stop());
    });
  });

  describe('start-stop', function () {
    const o = new StatefullClass(10, false);

    it('can be started', function (done) {
      o.start().then(() => {
        assert.equal(o.state, 'running');
        done();
      }, done);
    });

    it('and stoped', function (done) {
      o.stop().then(() => {
        assert.equal(o.state, 'stopped');
        done();
      }, done);
    });
  });

  it('can be started while starting', function (done) {
    const o = new StatefullClass(10, false);

    o.start().then(() => {});

    assert.equal(o.state, 'starting');

    o.start().then(() => {
      assert.equal(o.state, 'running');
      done();
    }, done).catch(done);
  });

  it('can be stopped while starting', function (done) {
    const o = new StatefullClass(100, false);

    o.start().then(() => {});

    assert.equal(o.state, 'starting');

    o.stop().then(() => {
      assert.equal(o.state, 'stopped');
      done();
    }, done).catch(done);
  });

  describe('failures', function () {
    it('handle timeout while starting', function (done) {
      const o = new StatefullClass(1000, false);
      o.start().then(() => {}).catch(e => {
        assert.equal(o.state, 'failed');
        done();
      });
    });

    it('handle failure while starting', function (done) {
      const o = new StatefullClass(10, true);

      o.start().then((f, r) => {
        console.log(`${f} ${r}`);
      }).catch(e => {
        //console.log(`catch: ${e}`);
        assert.equal(o.state, 'failed');
        done();
      });
    });
  });

});
