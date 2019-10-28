[![npm](https://img.shields.io/npm/v/statetransition-mixin.svg)](https://www.npmjs.com/package/statetransition-mixin)
[![Greenkeeper](https://badges.greenkeeper.io/arlac77/statetransition-mixin.svg)](https://greenkeeper.io/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/arlac77/statetransition-mixin)
[![styled with prettier](https://img.shields.io/badge/styled_with-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![Build Status](https://secure.travis-ci.org/arlac77/statetransition-mixin.png)](http://travis-ci.org/arlac77/statetransition-mixin)
[![codecov.io](http://codecov.io/github/arlac77/statetransition-mixin/coverage.svg?branch=master)](http://codecov.io/github/arlac77/statetransition-mixin?branch=master)
[![Known Vulnerabilities](https://snyk.io/test/github/arlac77/statetransition-mixin/badge.svg)](https://snyk.io/test/github/arlac77/statetransition-mixin)
[![GitHub Issues](https://img.shields.io/github/issues/arlac77/statetransition-mixin.svg?style=flat-square)](https://github.com/arlac77/statetransition-mixin/issues)
[![Dependency Status](https://david-dm.org/arlac77/statetransition-mixin.svg)](https://david-dm.org/arlac77/statetransition-mixin)
[![devDependency Status](https://david-dm.org/arlac77/statetransition-mixin/dev-status.svg)](https://david-dm.org/arlac77/statetransition-mixin#info=devDependencies)
[![docs](http://inch-ci.org/github/arlac77/statetransition-mixin.svg?branch=master)](http://inch-ci.org/github/arlac77/statetransition-mixin)
[![downloads](http://img.shields.io/npm/dm/statetransition-mixin.svg?style=flat-square)](https://npmjs.org/package/statetransition-mixin)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

# statetransition-mixin

mixin to declare state transition methods like start & stop

![start stop transition example](doc/start-stop.png)

# usage

<!-- skip-example -->

```js
import { StateTransitionMixin, prepareActions } = from 'statetransition-mixin';

const actions = prepareActions({
start: { // declare start() and call _start() internally
  stopped: {
    target: "running",
    during: "starting",
    timeout: 10
  }
},
stop: { // declare stop() and call _stop() internally
  running: {
    target: "stopped",
    during: "stopping",
    timeout: 5
  },
  starting: {
    target: "stopped",
    during: "stopping",
    timeout: 10
  }
}
});

class BaseClass {}

class StatefullClass extends StateTransitionMixin(BaseClass, actions, 'stopped') {
async _start() { // will be called to go from stopped to running
  return new Promise((f, r) => {
    setTimeout(() => {
      f(this)
    }, 10);
  });
}
}

let myObject = new StatefullClass();

console.log(myObject.state === 'stopped' ? "is stopped" : "hmm ?")

myObject.start().then( (o) => console.log('started == ${o.state}'));
console.log('starting == ${myObject.state}');

myObject.stop().then( (o) => console.log('stopped == ${o.state}'));
console.log('stopping == ${myObject.state}');
```

# API

<!-- Generated by documentation.js. Update this documentation by updating the source code. -->

### Table of Contents

-   [STATE_PROPERTY](#state_property)
-   [TRANSITION_PROPERTY](#transition_property)
-   [TRANSITION_PROMISE_PROPERTY](#transition_promise_property)
-   [Action](#action)
    -   [Properties](#properties)
-   [Transition](#transition)
    -   [Properties](#properties-1)
-   [prepareActions](#prepareactions)
    -   [Parameters](#parameters)
    -   [Examples](#examples)
-   [StateTransitionMixin](#statetransitionmixin)
    -   [Parameters](#parameters-1)
-   [clazz](#clazz)
-   [defineActionMethods](#defineactionmethods)
    -   [Special handling of consequent transitions](#special-handling-of-consequent-transitions)
    -   [Parameters](#parameters-2)

## STATE_PROPERTY

current state

## TRANSITION_PROPERTY

ongoing transition

## TRANSITION_PROMISE_PROPERTY

promise of the ongoing transition

## Action

Type: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

### Properties

-   `name` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** like 'start' or 'stop'
-   `transitions` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** possible transitions from the current state

## Transition

Type: [Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)

### Properties

-   `timeout` **[number](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Number)** in milliseconds the transtion is allowed to take
-   `initial` **[Transition](#transition)** 
-   `during` **[Transition](#transition)** 
-   `target` **[Transition](#transition)** 
-   `rejected` **[Transition](#transition)** 

## prepareActions

<!-- skip-example -->

Compile actions and states

### Parameters

-   `as` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** 

### Examples

```javascript
prepareActions({
'start':{
 'stopped': {
   'target': 'running',
   'during': 'starting'
}},
'stop': {
 'running': {
   'target': 'stopped',
   'during': 'stopping'
 }}});
```

Returns **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)** 

## StateTransitionMixin

Extends a class to support state transtions

### Parameters

-   `superclass` **Class** 
-   `actions` **[Array](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array)&lt;[Action](#action)>** 
-   `initialState` **[string](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String)** starting state

## clazz

Generated mixin class with support of state transtions

## defineActionMethods

Defines methods to perform the state transitions.
States are traversed in the following way:

 _current_ -> _during_ -> _final_

If the step is not in one of the transitions current
states and also not already in the transitions final
state a rejecting promise will be delivered from the
generated function. In the 'during' state a function
named '\_' + <transitions name> (sample: '\_start()')
will be called first.

It is expected that this function delivers a promise.

### Special handling of consequent transitions

While in a during state the former delivered promise will be
delivered again. This enshures that several consequent
transitions in a row will be fullfiled by the same promise.
There can only be one transition in place at a given point in time.

### Parameters

-   `object` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** target object where we define the methods
-   `actionsAndStates` **[Object](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Object)** object describing the state transitions
    -   `actionsAndStates.0`  
    -   `actionsAndStates.1`  

Returns **void** 

# install

With [npm](http://npmjs.org) do:

    npm install statetransition-mixin

# license

BSD-2-Clause
