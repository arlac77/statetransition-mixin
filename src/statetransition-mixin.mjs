/**
 * current state
 */
const STATE = Symbol("state");

/**
 * ongoing transition
 */
const TRANSITION = Symbol("transition");

/**
 * promise of the ongoing transition
 */
const TRANSITION_PROMISE = Symbol("transitionPromise");

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
 * <!-- skip-example -->
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

  return [
    Object.fromEntries(
      Object.entries(as).map(([name, a]) => {
        const initialTransitions = {};
        const duringTransitions = {};
        let target;

        Object.entries(a).forEach(([initialState, t]) => {
          if (t.rejected === undefined) {
            t.rejected = "failed";
          }

          initialTransitions[initialState] = t;
          duringTransitions[t.during] = t;
          t.initial = initialState;
          t.name = name;
          addState(t.initial, t);
          addState(t.during, t);
          addState(t.target);
          addState(t.rejected);
          target = t.target;
        });

        return [
          name,
          {
            name,
            initial: initialTransitions,
            during: duringTransitions,
            target
          }
        ];
      })
    ),
    states
  ];
}

/**
 * Extends a class to support state transtions
 * @param {Class} superclass
 * @param {Action[]} actions
 * @param {string} initialState starting state
 */
export function StateTransitionMixin(superclass, actions, initialState) {
  /**
   * Generated mixin class with support of state transtions
   */
  const clazz = class StateTransitionMixin extends superclass {
    constructor(...args) {
      super(...args);
      this[STATE] = initialState;
    }

    /**
     * Called when state transition action is not allowed
     * @param {Action} action to be acted on
     * @throws always Error indicating that the given state transition is not allowed
     */
     illegalStateTransition(action) {
      throw new Error(`Can't ${action.name} ${this} in ${this.state} state`);
    }

    /**
     * Called when the state transtion implementation promise rejects.
     * Resets the transition
     * @param {any} rejected initiating error
     * @param {string} newState final state of error
     * @throws always
     */
     stateTransitionRejection(rejected, newState) {
      this.state = newState;
      this[TRANSITION_PROMISE] = undefined;
      this[TRANSITION] = undefined;

      throw rejected;
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
     * Called to get the name value for a given transition
     * @param  {Transition} transition transtion to deliver timout value for
     * @return {string} name for a transition
     */
    nameForTransition(transition) {
      return `${transition.name}:${transition.initial}->${transition.target}`;
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
      return this[STATE];
    }

    /**
     * Sets the current state.
     * no transtion will be executed only the stateChanged method will be called
     * if the newState differs from the current state.
     * @param {string} newState target state
     * @return {void}
     */
    set state(newState) {
      if (newState !== this[STATE]) {
        this.stateChanged(this[STATE], newState);
        this[STATE] = newState;
      }
    }
  };

  defineActionMethods(clazz.prototype, actions);

  return clazz;
}

/**
 * Rejects promise when it is not resolved within given timeout.
 * @param {Promise} promise
 * @param {number} timeout in miliseconds
 * @param {string} name
 * @return {Promise}
 */
function rejectUnlessResolvedWithin(promise, timeout, name) {
  if (timeout === 0) return promise;

  return new Promise((resolve, reject) => {
    const th = setTimeout(
      () =>
        reject(new Error(`${name} request not resolved within ${timeout}ms`)),
      timeout
    );

    promise.then(resolve, reject).finally(() => clearTimeout(th));
  });
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
 * @return {void}
 */
export function defineActionMethods(object, [actions, states]) {
  Object.entries(actions).forEach(([actionName, action]) => {
    const privateActionName = "_" + actionName;

    if (!object.hasOwnProperty(privateActionName)) {
      Object.defineProperty(object, privateActionName, {
        value: async () => {}
      });
    }

    Object.defineProperty(object, actionName, {
      value: async function(...args) {
        // target state already reached
        if (this.state === action.target) {
          return this;
        }

        // normal start we are in the initial state of the action
        if (action.initial[this.state]) {
          // some transition is ongoing
          if (this[TRANSITION]) {
            const t = this[TRANSITION];
            try {
              // we terminate it silently ?
              this.stateTransitionRejection(
                new Error(`Terminate ${t.name} to prepare ${actionName}`),
                t.initial
              );
            } catch {}

            // then do what we originally wanted
            return this[actionName](...args);
          }

          this[TRANSITION] = action.initial[this.state];
          this.state = this[TRANSITION].during;

          this[TRANSITION_PROMISE] = rejectUnlessResolvedWithin(
            this[privateActionName](...args),
            this.timeoutForTransition(this[TRANSITION]),
            this.nameForTransition(this[TRANSITION])
          ).then(
            () => {
              if (!this[TRANSITION]) {
                // here we end if we canceled a transtion
                // need some better ideas to communicate
                return this;
              }

              this.state = this[TRANSITION].target;
              this[TRANSITION_PROMISE] = undefined;
              this[TRANSITION] = undefined;

              return this;
            },
            rejected =>
              this.stateTransitionRejection(
                rejected,
                this[TRANSITION] && this[TRANSITION].rejected
              )
          );

          return this[TRANSITION_PROMISE];
        } else if (this[TRANSITION]) {
          if (action.during[this[TRANSITION].during]) {
            return this[TRANSITION_PROMISE];
          }
        }

        return this.illegalStateTransition(action);
      }
    });
  });
}
