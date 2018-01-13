/**
 * current state
 */
const STATE_PROPERTY = Symbol('state');

/**
 * ongoing transition
 */
const TRANSITION_PROPERTY = Symbol('transition');

/**
 * promise of the ongoing transition
 */
const TRANSITION_PROMISE_PROPERTY = Symbol('transitionPromise');

/**
 * @typedef {Object} Action
 * @property {string} name like 'start' or 'stop'
 * @property {Object} transitions possible transitions from the current state
 */

/**
 * @typedef {Object} Transition
 * @property {number} timeout in milliseconds the transtion is allowed to take
 * @property {Transition} initial
 * @property {Transition} during
 * @property {Transition} target
 * @property {Transition} rejected
 */

/**
 * Compile actions and states
 * @example
 * prepareActions({
 * 'start':{
 *  'stopped': {
 *    'target': 'running',
 *    'during': 'starting'
 * }},
 * 'stop': {
 *  'running': {
 *    'target': 'stopped',
 *    'during': 'stopping'
 *  }}});
 * @param {Object} as
 * @return {Array}
 */
export function prepareActions(as) {
  const actions = {};
  const states = {};

  function addState(name, transition) {
    if (states[name] === undefined) {
      states[name] = {
        name,
        transitions: {}
      };
    }

    if (transition !== undefined) {
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

      if (t.rejected === undefined) {
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
      target
    };
  });

  return [actions, states];
}

/**
 * all methods provided in the mixin
 */
export const BaseMethods = {
  /**
   * Called when state transition action is not allowed
   * @param {Action} action to be acted on
   * @throws always Error indicating that the given state transition is not allowed
   */
  async illegalStateTransition(action) {
    throw new Error(`Can't ${action.name} ${this} in ${this.state} state`);
  },

  /**
   * Called when the state transtion implementation promise rejects.
   * Resets the transition
   * @param {any} rejected initiating error
   * @param {string} newState final state of error
   * @return {Promise<any>} rejecting promise
   */
  stateTransitionRejection(rejected, newState) {
    this.state = newState;
    this[TRANSITION_PROMISE_PROPERTY] = undefined;
    this[TRANSITION_PROPERTY] = undefined;
    return Promise.reject(rejected);
  },

  /**
   * Called to get the timeout value for a given transition
   * @param {Transition} transition the transition
   * @return {number} timeout in ms for the transition
   */
  timeoutForTransition(transition) {
    return transition.timeout;
  },

  /**
   * To be overwritten.
   * Called when the state changes
   * @param {string} oldState previous state
   * @param {string} newState new state
   * @return {void}
   */
  stateChanged(oldState, newState) {}
};

export function defineStateTransitionProperties(object, actions, currentState) {
  const properties = {};

  properties.state = {
    get() {
      return currentState;
    },
    set(newState) {
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
}

/**
 * Extends a class to support state transtions
 * @param {Class} superclass
 * @param {Action[]} actions
 * @param {string} initialState starting state
 */
export function StateTransitionMixin(superclass, actions, initialState) {
  const newClass =
    /**
     * Generated mixin class with support of state transtions
     */
    class StateTransitionMixin extends superclass {
      constructor(...args) {
        super(...args);
        this[STATE_PROPERTY] = initialState;
      }

      /**
       * Called when state transition action is not allowed
       * @param {Action} action to be acted on
       * @throws always Error indicating that the given state transition is not allowed
       */
      async illegalStateTransition(action) {
        throw new Error(`Can't ${action.name} ${this} in ${this.state} state`);
      }

      /**
       * Called when the state transtion implementation promise rejects.
       * Resets the transition
       * @param {any} rejected initiating error
       * @param {string} newState  final state of error
       * @return {Promise<any>} rejecting promise
       */
      stateTransitionRejection(rejected, newState) {
        this.state = newState;
        this[TRANSITION_PROMISE_PROPERTY] = undefined;
        this[TRANSITION_PROPERTY] = undefined;

        return Promise.reject(rejected);
      }

      /**
       * Called to get the timeout value for a given transition
       * By default we deliver the timeout property of the transition.
       * @param  {Transition} transition transtion to deliver timout value for
       * @return {number} timeout for the transition in milliseconds
       */
      timeoutForTransition(transition) {
        return transition.timeout;
      }

      /**
       * To be overwritten
       * Called when the state changes
       * @param {string} oldState previous state
       * @param {string} newState new state
       * @return {void}
       */
      stateChanged() {}

      /**
       * Delivers current state
       * return {string} current state
       */
      get state() {
        return this[STATE_PROPERTY];
      }

      /**
       * Sets the current state.
       * no transtion will be executed only the stateChanged method will be called
       * if the newState differs from the current state.
       * @param {string} newState target state
       * @return {void}
       */
      set state(newState) {
        if (newState !== this[STATE_PROPERTY]) {
          this.stateChanged(this[STATE_PROPERTY], newState);
          this[STATE_PROPERTY] = newState;
        }
      }
    };

  defineActionMethods(newClass.prototype, actions, true);
  return newClass;
}

function rejectUnlessResolvedWithin(promise, timeout, name) {
  if (timeout === 0) {
    return promise;
  }

  return new Promise((resolve, reject) => {
    const th = setTimeout(
      () => reject(new Error(`${name} not resolved within ${timeout}ms`)),
      timeout
    );

    return promise.then(
      fullfilled => {
        clearTimeout(th);
        resolve(fullfilled);
      },
      rejected => {
        clearTimeout(th);
        reject(rejected);
      }
    );
  });
}

function resolverPromise() {
  return Promise.resolve();
}

/**
 * Defines methods to perform the state transitions.
 * States are traversed in the following way:
 *
 *  *current* -> *during* -> *final*
 *
 * If the step is not in one of the transitions current
 * states and also not already in the transitions final
 * state a rejecting promise will be delivered from the
 * generated function. In the 'during' state a function
 * named '_' + <transitions name> (sample: '_start()')
 * will be called first.
 *
 * It is expected that this function delivers a promise.
 * ### Special handling of consequent transitions
 * While in a during state the former delivered promise will be
 * delivered again. This enshures that several consequent
 * transitions in a row will be fullfiled by the same promise.
 * There can only be one transition in place at a given point in time.
 * @param {Object} object target object where we define the methods
 * @param {Object} actionsAndStates object describing the state transitions
 * @param {boolean} enumerable should the action methods be enumerable defaults to false
 * @return {void}
 */
export function defineActionMethods(
  object,
  [actions, states],
  enumerable = false
) {
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

    defaultProperties.value = function() {
      // target state already reached
      if (this.state === action.target) {
        return Promise.resolve(this);
      }

      // normal start we are in the initial state of the action
      if (action.initial[this.state]) {
        // some transition is ongoing
        if (this[TRANSITION_PROPERTY]) {
          const t = this[TRANSITION_PROPERTY];

          // we terminate it silently ?
          // then do what we originally wanted
          return this.stateTransitionRejection(
            new Error(`Terminate ${t.name} to prepare ${actionName}`),
            t.initial
          ).then(() => {}, () => this[actionName]());
        }

        this[TRANSITION_PROPERTY] = action.initial[this.state];
        this.state = this[TRANSITION_PROPERTY].during;

        this[TRANSITION_PROMISE_PROPERTY] = rejectUnlessResolvedWithin(
          this[privateActionName](),
          this.timeoutForTransition(this[TRANSITION_PROPERTY]),
          this[TRANSITION_PROPERTY].name
        ).then(
          () => {
            if (!this[TRANSITION_PROPERTY]) {
              // here we end if we canceled a transtion
              // need some better ideas to communicate
              return this;
              /*
              return this.stateTransitionRejection(new Error(
                `Should never happen: ${this.state} and no transition coming from ${actionName}`
              ), 'failed');
              */
            }

            this.state = this[TRANSITION_PROPERTY].target;
            this[TRANSITION_PROMISE_PROPERTY] = undefined;
            this[TRANSITION_PROPERTY] = undefined;

            return this;
          },
          rejected =>
            this.stateTransitionRejection(
              rejected,
              this[TRANSITION_PROPERTY] && this[TRANSITION_PROPERTY].rejected
            )
        );

        return this[TRANSITION_PROMISE_PROPERTY];
      } else if (this[TRANSITION_PROPERTY]) {
        if (action.during[this[TRANSITION_PROPERTY].during]) {
          return this[TRANSITION_PROMISE_PROPERTY];
        }
      }

      return this.illegalStateTransition(action);
    };

    Object.defineProperty(object, actionName, defaultProperties);
  });
}
