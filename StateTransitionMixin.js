/* jslint node: true, esnext: true */
/* eslint-env es6 */
/* eslint valid-jsdoc: 2 */

"use strict";

module.exports.prepareActions = function (as) {
  const actions = {};
  const states = {};

  function addState(name, transition) {
    if (!states[name]) {
      states[name] = {
        name: name,
        transitions: {}
      };
    }

    if (transition) {
      states[name].transitions[transition.initial] = transition;
    }
  }

  Object.keys(as).forEach(actionName => {
    const a = as[actionName];
    const initialTransitions = {};
    const duringTransitions = {};
    let target;

    Object.keys(a).forEach(initialState => {
      const t = a[initialState];

      if (!t.rejected) {
        t.rejected = 'failed';
      }

      initialTransitions[initialState] = t;
      duringTransitions[t.during] = t;
      t.initial = initialState;
      t.name = `${actionName}:${t.initial}->${t.target}`;
      addState(t.initial, t);
      addState(t.during, t);
      addState(t.target);
      addState(t.rejected);
      target = t.target;
    });
    actions[actionName] = {
      name: actionName,
      initial: initialTransitions,
      during: duringTransitions,
      target: target
    };
  });

  /*
    console.log(`${JSON.stringify(actions,undefined,1)}`);
    console.log(`${JSON.stringify(states,undefined,1)}`);
  */

  return [actions, states];
};

const BaseMethods = {
  /**
   * Called when state transition action is not allowed
   * @param {Object} action to be acted on
   * @return {Promise} rejecting with an Error
   */
  illegalStateTransition(action) {
      return Promise.reject(new Error(`Can't ${action.name} ${this} in ${this.state} state`));
    },

    /**
     * Called when the state transtion implementation promise rejects.
     * Resets the transition
     * @param {Object} rejected initiating error
     * @param {String} newState final state of error
     * @return {Promise} rejecting promise
     */
    stateTransitionRejection(rejected, newState) {
      this.state = newState;
      this._transitionPromise = undefined;
      this._transition = undefined;
      return Promise.reject(rejected);
    },

    /**
     * Called to get the timeout value for a given transition
     * @param {Object} transition
     * @return {number} timeout for the transition
     */
    timeoutForTransition(transition) {
      return transition.timeout;
    },

    /**
     * To be overwritten
     * Called when the state changes
     * @param {String} oldState previous state
     * @param {String} newState new state
     * @return {void}
     */
    stateChanged(oldState, newState) {}
};

exports.BaseMethods = BaseMethods;

exports.defineStateTransitionProperties = function (object, actions, currentState) {

  const properties = {};

  properties.state = {
    get: function () {
      return currentState;
    },
    set: function (newState) {
      if (newState !== currentState) {
        this.stateChanged(currentState, newState);
        currentState = newState;
      }
    }
  };

  Object.keys(BaseMethods).forEach(name => {
    if (object[name] === undefined) {
      object[name] = BaseMethods[name];
    }
  });

  Object.defineProperties(object, properties);
};

module.exports.StateTransitionMixin = (superclass, actions, currentState) => class extends superclass {
  constructor() {
      super();
      this._state = currentState;
    }
    /**
     * Called when state transition action is not allowed
     * @param {Object} action to be acted on
     * @return {Promise} rejecting with an Error
     */
  illegalStateTransition(action) {
    return Promise.reject(new Error(`Can't ${action.name} ${this} in ${this.state} state`));
  }

  /**
   * Called when the state transtion implementation promise rejects.
   * Resets the transition
   * @param {Object} rejected initiating error
   * @param {String} newState final state of error
   * @return {Promise} rejecting promise
   */
  stateTransitionRejection(rejected, newState) {
    this.state = newState;
    this._transitionPromise = undefined;
    this._transition = undefined;

    return Promise.reject(rejected);
  }

  /**
   * Called to get the timeout value for a given transition
   * @param {Object} transition
   * @return {number} timeout for the transition
   */
  timeoutForTransition(transition) {
    return transition.timeout;
  }

  /**
   * To be overwritten
   * Called when the state changes
   * @param {String} oldState previous state
   * @param {String} newState new state
   * @return {void}
   */
  stateChanged(oldState, newState) {}

  get state() {
    return this._state;
  }
  set state(newState) {
    if (newState !== this._state) {
      this.stateChanged(this._state, newState);
      this._state = newState;
    }
  }
};

function rejectUnlessResolvedWithin(promise, timeout, name) {
  if (timeout === 0) return promise;

  return new Promise((fullfill, reject) => {
    const th = setTimeout(() => reject(new Error(`${name} not resolved within ${timeout}ms`)), timeout);

    return promise.then(fullfilled => {
      clearTimeout(th);
      fullfill(fullfilled);
    }, rejected => {
      clearTimeout(th);
      reject(rejected);
    });
  });
}

function resolverPromise() {
  return Promise.resolve();
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
 * While in a during state the former delivered promise will be
 * delivered again. This enshures that several consequent
 * transitions in a row will be fullfiled by the same promise.
 * There can only be one transition in place at a given point in time.
 * @param {Object} object where we define the metods
 * @param {Object} actionsAndStates object describing the state transitions
 * @param {Boolean} enumerable should the action methods be enumerable defaults to false
 * @return {void}
 */
module.exports.defineActionMethods = function (object, actionsAndStates, enumerable = false) {
  const actions = actionsAndStates[0];
  const states = actionsAndStates[1];

  const defaultProperties = {};

  if (enumerable) {
    defaultProperties.enumerable = true;
  }

  Object.keys(actions).forEach(actionName => {
    const action = actions[actionName];
    const privateActionName = '_' + actionName;

    if (!object.hasOwnProperty(privateActionName)) {
      defaultProperties.value = resolverPromise;
      Object.defineProperty(object, privateActionName, defaultProperties);
    }

    defaultProperties.value = function () {
      // target state already reached
      if (this.state === action.target) {
        return Promise.resolve(this);
      }

      // normal start we are in the initial state of the action
      if (action.initial[this.state]) {

        // some transition is ongoing
        if (this._transition) {
          const t = this._transition;

          // we terminate it silently ?
          // then do what we originally wanted
          return this.stateTransitionRejection(new Error(
            `Terminate ${t.name} to prepare ${actionName}`), t.initial).
          then(f => {}, r => {
            return this[actionName]();
          });
        }

        this._transition = action.initial[this.state];
        this.state = this._transition.during;

        this._transitionPromise = rejectUnlessResolvedWithin(this[privateActionName](), this.timeoutForTransition(
          this._transition), this._transition.name).then(
          resolved => {
            if (!this._transition) {
              // here we end if we canceled a transtion
              // need some better ideas to communicate
              return this;
              /*
              return this.stateTransitionRejection(new Error(
                `Should never happen: ${this.state} and no transition coming from ${actionName}`
              ), 'failed');
              */
            }

            this.state = this._transition.target;
            this._transitionPromise = undefined;
            this._transition = undefined;

            return this;
          }, rejected => this.stateTransitionRejection(rejected, this._transition && this._transition.rejected)
        );

        return this._transitionPromise;
      } else if (this._transition) {
        if (action.during[this._transition.during]) {
          return this._transitionPromise;
        }
      }

      return this.illegalStateTransition(action);
    };

    Object.defineProperty(object, actionName, defaultProperties);
  });
};
