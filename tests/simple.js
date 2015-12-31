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
      timeout: 0
    }
  },
  swim: {
    diving: {
      target: "swimming"
    }
  }
});

class BaseClass {}

class StatefullClass extends stm.StateTransitionMixin(BaseClass, actions, 'stopped') {
  constructor(startTime, shouldReject, shouldThrow) {
    super();
    this.startTime = startTime;
    this.shouldReject = shouldReject;
    this.shouldThrow = shouldThrow;
  }
  _start() {
    if (this.startTime === 0) {
      if (this.shouldReject) return Promise.reject(new Error("always reject"));
      if (this.shouldThrow) throw new Error("always throw");
    }
    return new Promise((f, r) => {
      setTimeout(() => {
        if (this.shouldReject) {
          r(Promise.reject(new Error("always reject")));
        }
        if (this.shouldThrow) throw new Error("always throw");
        else {
          f(this);
        }
      }, this.startTime);
    });
  }

  toString() {
    return 'ES6 class';
  }
}

stm.defineActionMethods(StatefullClass.prototype, actions, true);

describe('ES6 class', function () {
  checks((timeout, fail) => new StatefullClass(timeout, fail));
});

describe('plain object', function () {
  checks((startTime, shouldReject, shouldThrow) => {
    const o = {
      toString() {
          return "plain object";
        },
        _start() {
          if (startTime === 0) {
            if (shouldReject) return Promise.reject(new Error("always reject"));
            if (shouldThrow) throw new Error("always throw");
          }

          return new Promise((f, r) => {
            setTimeout(() => {
              if (shouldReject) {
                r(Promise.reject(new Error("always reject")));
              }
              if (this.shouldThrow) throw new Error("always throw");
              else {
                f(this);
              }
            }, startTime);
          });
        }
    };
    stm.defineActionMethods(o, actions, true);
    stm.defineStateTransitionProperties(o, actions, "stopped");

    return o;
  });
});

function checks(factory) {
  describe('states', function () {
    describe('static', function () {
      const o = factory(10, false);

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

      it('defined methods are enumerable', function () {
        const assigend = Object.assign({}, StatefullClass.prototype);
        assert.isDefined(assigend.start);
      });
    });

    describe('start-stop', function () {
      const o = factory(10, false);

      it('can be started', function (done) {
        o.start().then(() => {
          assert.equal(o.state, 'running');
          done();
        }, done);
      });

      it('can be started while running', function (done) {
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
      const o = factory(10, false);

      o.start().then(() => {});

      assert.equal(o.state, 'starting');

      o.start().then(() => {
        assert.equal(o.state, 'running');
        done();
      }, done).catch(done);
    });

    it('can be stopped while starting', function (done) {
      const o = factory(100, false);

      o.start().then(() => {});

      assert.equal(o.state, 'starting');

      o.stop().then(() => {
        assert.equal(o.state, 'stopped');
        done();
      }, done).catch(done);
    });

    describe('failures', function () {
      it('illegal transition', function (done) {
        const o = factory(0, false, false);
        try {
          o.swim().then(() => {
            console.log(`swimming ?`);
          }).catch(e => {
            //console.log(`swimming failed: ${e}`);
            assert.ok(o.state);
            done();
          });
        } catch (e) {
          console.log(`error: ${e}`);
          done(e);
        }
      });

      it('handle timeout while starting', function (done) {
        const o = factory(1000, false, false);
        o.start().then(() => {}).catch(e => {
          assert.equal(o.state, 'failed');
          done();
        });
      });

      chechFailure('failure (reject)', true, false);
      chechFailure('failure (throw)', false, true);

      function chechFailure(name, shouldReject, shoudThrow) {
        it(`handle ${name} while starting without timeout guard`, function (done) {
          const o = factory(0, true, false);

          o.start().then((f, r) => {
            console.log(`${f} ${r}`);
          }).catch(e => {
            console.log(`catch ${name} ${e}`);
            assert.equal(o.state, 'failed');
            done();
          });
        });

        it(`handle ${name} while starting with timeout guard`, function (done) {
          const o = factory(10, true, false);

          o.start().then((f, r) => {
            console.log(`${f} ${r}`);
          }).catch(e => {
            console.log(`catch ${name} ${e}`);
            assert.equal(o.state, 'failed');
            done();
          });
        });
      }
    });
  });
}
