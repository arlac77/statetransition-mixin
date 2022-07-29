import test from "ava";

import { prepareActions, StateTransitionMixin } from "statetransition-mixin";

const actions = prepareActions({
  start: {
    stopped: {
      target: "running",
      during: "starting",
      rejected: "failed_special",
      timeout: 200
    }
  },
  stop: {
    running: {
      target: "stopped",
      during: "stopping",
      rejected: "failed",
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

class StatefullClass extends StateTransitionMixin(
  class BaseClass {},
  actions,
  "stopped"
) {
  constructor(startTime, shouldReject, shouldThrow) {
    super();
    this.startTime = startTime;
    this.shouldReject = shouldReject;
    this.shouldThrow = shouldThrow;
  }
  async _start(...args) {
    this.args = args;

    if (this.startTime === 0) {
      if (this.shouldReject) return Promise.reject(new Error("always reject"));
      if (this.shouldThrow) throw new Error("always throw");
    }
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (this.shouldThrow) throw new Error("always throw");

        if (this.shouldReject) {
          reject(new Error("always reject"));
        } else {
          resolve(this);
        }
      }, this.startTime);
    });
  }

  async _stop() {}

  toString() {
    return "ES2015 class";
  }

  stateChanged(origin, oldState, newState) {
    this._newState = newState;
  }
}

test("static class", t =>
  staticChecks(t, (timeout, fail) => new StatefullClass(timeout, fail)));

test("dynamic class", t =>
  dynamicChecks(t, (timeout, fail) => new StatefullClass(timeout, fail)));

test("dynamic failure class", t =>
  dynamicFailureChecks(
    t,
    (timeout, fail) => new StatefullClass(timeout, fail)
  ));

function staticChecks(t, factory) {
  const o = factory(10, false);

  o.state = "stopped";
  t.is(o.state, "stopped");

  // has action methods'
  t.truthy(o.start instanceof Function);
  t.truthy(o._start instanceof Function);
  t.truthy(o.stop instanceof Function);
  t.truthy(o._stop instanceof Function);

  // defined methods are enumerable'
  //const assigend = Object.assign({}, StatefullClass.prototype);
  //t.truthy(assigend.start);
}

async function dynamicChecks(t, factory) {
  const o = factory(10, false);

  o.start(4711);

  await o.start();

  t.deepEqual(o.args, [4711]);

  t.is(o.state, "running");

  // has stateChanged called
  t.is(o._newState, "running");

  // can be started while running
  await o.start();
  await o.start();
  t.is(o.state, "running");

  // and stoped
  await o.stop();

  t.is(o.state, "stopped");

  // can be started while starting
  const o2 = factory(10, false);
  o2.start();
  t.is(o2.state, "starting");
  await o2.start();
  t.is(o2.state, "running");

  // can be stopped while starting
  const o3 = factory(100, false);
  o3.start();
  t.is(o3.state, "starting");
  await o3.stop();
  t.is(o3.state, "stopped");
}

async function dynamicFailureChecks(t, factory) {
  // illegal transition
  await t.throwsAsync(
    async () => {
      const o = factory(0, false, false);
      await o.swim();
    },
    undefined,
    "Can't swim ES2015 class in stopped state"
  );

  // timeout while starting
  await t.throwsAsync(
    async () => {
      const o = factory(1000, false, false);
      await o.start();
    },
    undefined,
    "start:stopped->running request not resolved within 200ms"
  );

  // reject while starting without timeout guard
  await t.throwsAsync(
    async () => {
      const o = factory(0, true, false);
      await o.start();
    },
    undefined,
    "always reject"
  );

  let o;
  // throw while starting with timeout guard
  await t.throwsAsync(async () => {
    o = factory(10, true, false);
    await o.start();
  });

  t.is(o.state, "failed_special");
}
