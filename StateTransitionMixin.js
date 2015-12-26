/* jslint node: true, esnext: true */

"use strict";

module.exports.prepareActions = function (as) {
  const actions = {};

  Object.keys(as).forEach(name => {
    const a = as[name];
    const ts = {};
    Object.keys(a).forEach(tn => {
      ts[tn] = a[tn];
      a[tn].name = tn;
    });
    actions[name] = {
      name: name,
      transitions: ts
    };
  });

  return actions;
};

module.exports.StateTransitionMixin = (superclass, actions, currentState) => class extends superclass {
  /**
   * Called when state action is not allowed
   * @param {Object} action
   * @return {Promise} rejecting with an Error
   */
  illegalStateTransition(action) {
    return Promise.reject(new Error(`Can't ${action.name} ${this} in ${this.state} state`));
  }

  /**
   * Called when the state transtinio implementation Promise rejects.
   * Resets the transition
   * @return {Promise} rejecting promise
   */
  stateTransitionRejection(rejected) {
    //this.error(level => `Executing ${this._transition.name} transition leads to ${rejected}`);
    this.state = 'failed';
    this._transitionPromise = undefined;
    this._transition = undefined;

    return Promise.reject(rejected);
  }

  /**
   * To be overwritten
   * Called when the state changes
   * @param {String} oldState
   * @param {String} newState
   */
  stateChanged(oldState, newState) {
    //this.trace(level => `${this} transitioned from ${oldState} -> ${newState}`);
  }

  get state() {
    return currentState;
  }
  set state(newState) {
    if (newState !== currentState) {
      this.stateChanged(currentState, newState);
      currentState = newState;
    }
  }
};

function rejectUnlessResolvedWithin(promise, timeout) {
  if (timeout === 0) return promise;

  return new Promise(function (fullfill, reject) {
    const p = promise.then((fullfilled, rejected) => {
      fullfilled(this);
    });

    setTimeout(function () {
      reject(`Not resolved within ${timeout}s`);

    }, timeout * 1000);
  });
}

function thisResolverPromise() {
  return Promise.resolve(this);
}

/**
 * Defines methods to perfom the state transitions.
 * States are traversed in the following way:
 * current -> during -> final
 * If the step is not in one of the transitions current
 * states and also not already in the transitions final
 * state a rejecting promise will be delivered from the
 * generated function. In the 'during' state a function
 * named '_' + <transitions name> (sample: '_start()')
 * will be called first.
 * It is expected that this function delivers a promise.
 * Special handling of consequent transitions:
 * While in a during state the former delivered primise will be
 * delivered again. This enshures that several consequent
 * transitions in a row will be fullfiled by the same promise.
 * There can only be one transition in place at a given point in time.
 * @param {Object} object where we define the metods
 * @param {Object} actions object describing the state transitions
 */
module.exports.defineActionMethods = function (object, actions) {
  //console.log(`${JSON.stringify(actions,undefined,1)}`);

  Object.keys(actions).forEach(actionName => {
    const action = actions[actionName];
    const privateActionName = '_' + actionName;

    if (!object.hasOwnProperty(privateActionName)) {
      Object.defineProperty(object, privateActionName, {
        value: thisResolverPromise
      });
    }

    Object.defineProperty(object, actionName, {
      value: function () {
        if (this._transition) {
          switch (this.state) {
            case this._transition.during:
              return this._transitionPromise;
            case this._transition.target:
              return Promise.resolve(this);
          }
        }
        if (action.transitions[this.state]) {
          this._transition = action.transitions[this.state];
          this.state = this._transition.during;

          this._transitionPromise = this[privateActionName]().then(
            resolved => {
              this.state = this._transition.target;
              this._transitionPromise = undefined;
              this._transition = undefined;
              return this;
            }, rejected => this.stateTransitionRejection(rejected));

          return this._transitionPromise;
        } else {
          return this.illegalStateTransition(action);
        }
      }
    });
  });
};

/*
function mixin(target, source) {
  target = target.prototype; source = source.prototype;

  Object.getOwnPropertyNames(source).forEach(function (name) {
    if (name !== "constructor") Object.defineProperty(target, name,
      Object.getOwnPropertyDescriptor(source, name));
  });
}
*/
