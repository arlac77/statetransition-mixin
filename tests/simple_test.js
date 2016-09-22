/* global describe, it, xit */
/* jslint node: true, esnext: true */

'use strict';

const chai = require('chai'),
  assert = chai.assert,
  expect = chai.expect,
  should = chai.should(),
  stm = require('../StateTransitionMixin');

const actions = stm.prepareActions({
  start: {
    stopped: {
      target: 'running',
      during: 'starting',
      rejected: 'failed_special',
      timeout: 200
    }
  },
  stop: {
    running: {
      target: 'stopped',
      during: 'stopping',
      rejected: 'failed',
      timeout: 100
    },
    starting: {
      target: 'stopped',
      during: 'stopping',
      timeout: 0
    }
  },
  swim: {
    diving: {
      target: 'swimming'
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
      if (this.shouldReject) return Promise.reject(new Error('always reject'));
      if (this.shouldThrow) throw new Error('always throw');
    }
    return new Promise((f, r) => {
      setTimeout(() => {
        if (this.shouldReject) {
          r(Promise.reject(new Error('always reject')));
        }
        if (this.shouldThrow) throw new Error('always throw');
        else {
          f(this);
        }
      }, this.startTime);
    });
  }

  toString() {
    return 'ES2015 class';
  }

  stateChanged(oldState, newState) {
    this._newState = newState;
  }
}

stm.defineActionMethods(StatefullClass.prototype, actions, true);

describe('ES2015 class', () => checks((timeout, fail) => new StatefullClass(timeout, fail)));

describe('plain object', () =>
  checks((startTime, shouldReject, shouldThrow) => {
    const o = {
      stateChanged(oldState, newState) {
          this._newState = newState;
        },

        toString() {
          return 'plain object';
        },

        _start() {
          if (startTime === 0) {
            if (shouldReject) return Promise.reject(new Error('always reject'));
            if (shouldThrow) throw new Error('always throw');
          }

          return new Promise((f, r) => {
            setTimeout(() => {
              if (shouldReject) {
                r(Promise.reject(new Error('always reject')));
              }
              if (this.shouldThrow) {
                throw new Error('always throw');
              } else {
                f(this);
              }
            }, startTime);
          });
        }
    };
    stm.defineActionMethods(o, actions, true);
    stm.defineStateTransitionProperties(o, actions, 'stopped');

    return o;
  })
);

function checks(factory) {
  describe('states', () => {
    describe('static', () => {
      const o = factory(10, false);

      it('has initial state', () => {
        o.state = 'stopped';
        assert.equal(o.state, 'stopped');
      });

      it('has action methods', () => {
        assert.isDefined(o.stop);
        assert.isDefined(o.start);
        assert.isDefined(o._start);
        assert.isDefined(o._stop);
      });

      it('defined methods are enumerable', () => {
        const assigend = Object.assign({}, StatefullClass.prototype);
        assert.isDefined(assigend.start);
      });
    });

    describe('start-stop', () => {
      const o = factory(10, false);

      it('can be started', done => {
        o.start().then(() => {
          assert.equal(o.state, 'running');
          done();
        }, done);
      });

      it('has stateChanged called', done => {
        o.start().then(() => {
          assert.equal(o._newState, 'running');
          done();
        }, done);
      });

      it('can be started while running', done => {
        o.start().then(() => {
          assert.equal(o.state, 'running');
          done();
        }, done);
      });

      it('and stoped', done => {
        o.stop().then(() => {
          assert.equal(o.state, 'stopped');
          done();
        }, done);
      });
    });

    it('can be started while starting', done => {
      const o = factory(10, false);

      o.start().then(() => {});

      assert.equal(o.state, 'starting');

      o.start().then(() => {
        assert.equal(o.state, 'running');
        done();
      }, done).catch(done);
    });

    it('can be stopped while starting', done => {
      const o = factory(100, false);

      o.start().then(() => {});

      assert.equal(o.state, 'starting');

      o.stop().then(() => {
        assert.equal(o.state, 'stopped');
        done();
      }, done).catch(done);
    });

    describe('failures', () => {
      it('illegal transition', done => {
        const o = factory(0, false, false);
        try {
          o.swim().then(() => {
            //console.log(`swimming ?`);
          }).catch(e => {
            //console.log(`swimming failed: ${e}`);
            assert.ok(o.state);
            done();
          });
        } catch (e) {
          //console.log(`error: ${e}`);
          done(e);
        }
      });

      it('handle timeout while starting', done => {
        const o = factory(1000, false, false);
        o.start().then(() => {}).catch(e => {
          assert.equal(o.state, 'failed_special');
          done();
        });
      });

      checkFailure('failure (reject)', true, false);
      checkFailure('failure (throw)', false, true);

      function checkFailure(name, shouldReject, shoudThrow) {
        it(`handle ${name} while starting without timeout guard`, done => {
          const o = factory(0, true, false);

          o.start().then(f => {}, r => {
            assert.equal(o.state, 'failed_special');
            done();
          });
        });

        it(`handle ${name} while starting with timeout guard`, done => {
          const o = factory(10, true, false);

          o.start().then(f => {}, r => {
            //console.log(`catch ${name} ${r}`);
            assert.equal(o.state, 'failed_special');
            done();
          });
        });
      }
    });
  });
}
