/* jslint node: true, esnext: true */

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

    return states[name];
  }

  Object.keys(as).forEach(actionName => {
    const a = as[actionName];
    const initialTransitions = {};
    const duringTransitions = {};
    let target;

    Object.keys(a).forEach(initialState => {
      const t = a[initialState];
      initialTransitions[initialState] = t;
      duringTransitions[t.during] = t;
      t.initial = initialState;
      t.name = `${actionName}:${t.initial}->${t.target}`;
      addState(t.initial, t);
      addState(t.during, t);
      addState(t.target);
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
   * @param {Object} action
   * @return {Promise} rejecting with an Error
   */
  illegalStateTransition(action) {
      return Promise.reject(new Error(`Can't ${action.name} ${this} in ${this.state} state`));
    },

    /**
     * Called when the state transtion implementation promise rejects.
     * Resets the transition
     * @return {Promise} rejecting promise
     */
    stateTransitionRejection(rejected, newState) {
      this.state = newState;
      this._transitionPromise = undefined;
      this._transition = undefined;
      return Promise.reject(rejected);
    },

    /**
     * To be overwritten
     * Called when the state changes
     * @param {String} oldState
     * @param {String} newState
     */
    stateChanged(oldState, newState) {}
};

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

  Object.assign(object, BaseMethods);
  Object.defineProperties(object, properties);
};

module.exports.StateTransitionMixin = (superclass, actions, currentState) => class extends superclass {
  constructor() {
      super();
      this._state = currentState;
    }
    /**
     * Called when state transition action is not allowed
     * @param {Object} action
     * @return {Promise} rejecting with an Error
     */
  illegalStateTransition(action) {
    return Promise.reject(new Error(`Can't ${action.name} ${this} in ${this.state} state`));
  }

  /**
   * Called when the state transtion implementation promise rejects.
   * Resets the transition
   * @return {Promise} rejecting promise
   */
  stateTransitionRejection(rejected, newState) {
    this.state = newState;
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

function rejectUnlessResolvedWithin(promise, timeout) {
  if (timeout === 0) return promise;

  return new Promise(function (fullfill, reject) {
    const th = setTimeout(() => {
      reject(new Error(`Not resolved within ${timeout}ms`))
    }, timeout);

    return promise.then(fullfilled => {
      clearTimeout(th);
      fullfill(fullfilled);
    }, rejected => {
      clearTimeout(th);
      reject(rejected);
    });
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
 * @param {Object} object where we define the metods
 * @param {Object} actionsAndStates object describing the state transitions
 * @param {Boolean} enumerable should the action methods be enumerable defaults to false
 */
module.exports.defineActionMethods = function (object, actionsAndStates, enumerable) {
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
      defaultProperties.value = thisResolverPromise;
      Object.defineProperty(object, privateActionName, defaultProperties);
    }

    defaultProperties.value = function () {
      // target state already reached
      if (this.state === action.target) {
        return Promise.resolve(this);
      }

      // normal start we are in the initial state of the action
      if (action.initial[this.state]) {
        if (this._transition) {
          const t = this._transition;
          return this.stateTransitionRejection(new Error(
            `Terminate ${t.name} to prepare ${actionName}`), this.state).
          then(f => {}, r => {
            //console.log(`${actionName} after rejecting ${t.name}`);
            return this[actionName]();
          });
        }

        this._transition = action.initial[this.state];
        this.state = this._transition.during;

        this._transitionPromise = rejectUnlessResolvedWithin(this[privateActionName](), this._transition
          .timeout).then(
          resolved => {
            if (!this._transition) {
              return this.stateTransitionRejection(new Error(
                `Should never happen: ${this.state} and no transition coming from ${actionName}`
              ), 'failed');
            }

            this.state = this._transition.target;
            this._transitionPromise = undefined;
            this._transition = undefined;

            return this;
          }, rejected => this.stateTransitionRejection(rejected, 'failed'));

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
