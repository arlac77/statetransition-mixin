import test from 'ava';

import {
  prepareActions,
  StateTransitionMixin,
  defineActionMethods,
  defineStateTransitionProperties
} from '../src/statetransition-mixin';

const actions = prepareActions({
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

class StatefullClass extends StateTransitionMixin(
  class BaseClass {},
  actions,
  'stopped'
) {
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

//defineActionMethods(StatefullClass.prototype, actions, true);

function plainObject(startTime, shouldReject, shouldThrow) {
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
  defineActionMethods(o, actions, true);
  defineStateTransitionProperties(o, actions, 'stopped');

  return o;
}

test('static ES2015 class', t =>
  staticChecks(t, (timeout, fail) => new StatefullClass(timeout, fail)));

test('dynamic ES2015 class', t =>
  dynamicChecks(t, (timeout, fail) => new StatefullClass(timeout, fail)));
test('dynamic failure ES2015 class', t =>
  dynamicFailureChecks(
    t,
    (timeout, fail) => new StatefullClass(timeout, fail)
  ));

test('static plain object', t => staticChecks(t, plainObject));
test('dynamic plain object', t => dynamicChecks(t, plainObject));
test('dynamic failure plain object', t => dynamicFailureChecks(t, plainObject));

function staticChecks(t, factory) {
  const o = factory(10, false);

  o.state = 'stopped';
  t.is(o.state, 'stopped');

  // has action methods'
  t.truthy(o.stop);
  t.truthy(o.start);
  t.truthy(o._start);
  t.truthy(o._stop);

  // defined methods are enumerable'
  //const assigend = Object.assign({}, StatefullClass.prototype);
  //t.truthy(assigend.start);
}

async function dynamicChecks(t, factory) {
  const o = factory(10, false);

  await o.start();

  t.is(o.state, 'running');

  // has stateChanged called
  t.is(o._newState, 'running');

  // can be started while running
  await o.start();
  t.is(o.state, 'running');

  // and stoped
  await o.stop();

  t.is(o.state, 'stopped');

  // can be started while starting
  const o2 = factory(10, false);
  o2.start();
  t.is(o2.state, 'starting');
  await o2.start();
  t.is(o2.state, 'running');

  // can be stopped while starting
  const o3 = factory(100, false);
  o3.start();
  t.is(o3.state, 'starting');
  await o3.stop();
  t.is(o3.state, 'stopped');
}

async function dynamicFailureChecks(t, factory) {
  const o = factory(0, false, false);

  // illegal transition
  try {
    await o.swim();
  } catch (error) {
    t.truthy(error.message.match(/in stopped state/));
  }

  // handle timeout while starting
  const o2 = factory(1000, false, false);
  try {
    await o2.start();
  } catch (error) {
    //t.is(o.state, 'failed_special');
    t.truthy(error.message.match(/running not resolved within 200ms/));
  }
}

/*
      checkFailure('failure (reject)', true, false);
      checkFailure('failure (throw)', false, true);

      function checkFailure(name, shouldReject, shoudThrow) {
        it(`handle ${name} while starting without timeout guard`, done => {
          const o = factory(0, true, false);

          o.start().then(
            f => {},
            r => {
              assert.equal(o.state, 'failed_special');
              done();
            }
          );
        });

        it(`handle ${name} while starting with timeout guard`, done => {
          const o = factory(10, true, false);

          o.start().then(
            f => {},
            r => {
              //console.log(`catch ${name} ${r}`);
              assert.equal(o.state, 'failed_special');
              done();
            }
          );
        });
      }
    });
  });
  */
