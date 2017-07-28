[![npm](https://img.shields.io/npm/v/statetransition-mixin.svg)](https://www.npmjs.com/package/statetransition-mixin)
[![Greenkeeper](https://badges.greenkeeper.io/arlac77/statetransition-mixin.svg)](https://greenkeeper.io/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/arlac77/statetransition-mixin)
[![Build Status](https://secure.travis-ci.org/arlac77/statetransition-mixin.png)](http://travis-ci.org/arlac77/statetransition-mixin)
[![bithound](https://www.bithound.io/github/arlac77/statetransition-mixin/badges/score.svg)](https://www.bithound.io/github/arlac77/statetransition-mixin)
[![codecov.io](http://codecov.io/github/arlac77/statetransition-mixin/coverage.svg?branch=master)](http://codecov.io/github/arlac77/statetransition-mixin?branch=master)
[![Coverage Status](https://coveralls.io/repos/arlac77/statetransition-mixin/badge.svg)](https://coveralls.io/r/arlac77/statetransition-mixin)
[![Code Climate](https://codeclimate.com/github/arlac77/statetransition-mixin/badges/gpa.svg)](https://codeclimate.com/github/arlac77/statetransition-mixin)
[![Known Vulnerabilities](https://snyk.io/test/github/arlac77/statetransition-mixin/badge.svg)](https://snyk.io/test/github/arlac77/statetransition-mixin)
[![GitHub Issues](https://img.shields.io/github/issues/arlac77/statetransition-mixin.svg?style=flat-square)](https://github.com/arlac77/statetransition-mixin/issues)
[![Stories in Ready](https://badge.waffle.io/arlac77/statetransition-mixin.svg?label=ready&title=Ready)](http://waffle.io/arlac77/statetransition-mixin)
[![Dependency Status](https://david-dm.org/arlac77/statetransition-mixin.svg)](https://david-dm.org/arlac77/statetransition-mixin)
[![devDependency Status](https://david-dm.org/arlac77/statetransition-mixin/dev-status.svg)](https://david-dm.org/arlac77/statetransition-mixin#info=devDependencies)
[![docs](http://inch-ci.org/github/arlac77/statetransition-mixin.svg?branch=master)](http://inch-ci.org/github/arlac77/statetransition-mixin)
[![downloads](http://img.shields.io/npm/dm/statetransition-mixin.svg?style=flat-square)](https://npmjs.org/package/statetransition-mixin)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

statetransition-mixin
====
mixin to declare state transition methods like start & stop

![start stop transition example](doc/start-stop.png)

usage
=====

```js
const stm = require('statetransition-mixin');

const actions = stm.prepareActions({
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


let myObject = {
    _start() { // will be called to go from stopped to running
    return Promise.resolve();
    }
};

stm.defineActionMethods(myObject, actions, true);
stm.defineStateTransitionProperties(myObject, actions, "stopped");

myObject.start().then( (o) => console.log('started == ${o.state}'));
console.log('starting == ${myObject.state}');

myObject.stop().then( (o) => console.log('stopped == ${o.state}'));
console.log('stopping == ${myObject.state}');
```

for ES2015 classes to
------------------

<!-- skip-example -->
```es6
const stm = require('statetransition-mixin');

const actions = stm.prepareActions({
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

class StatefullClass extends stm.StateTransitionMixin(BaseClass, actions, 'stopped') {
_start() { // will be called to go from stopped to running
  return new Promise((f, r) => {
    setTimeout(() => {
      f(this)
    }, 10);
  });
}
}

stm.defineActionMethods(StatefullClass.prototype, actions);

let myObject = new StatefullClass();

console.log(myObject.state === 'stopped' ? "is stopped" : "hmm ?")

myObject.start().then( (o) => console.log('started == ${o.state}'));
console.log('starting == ${myObject.state}');

myObject.stop().then( (o) => console.log('stopped == ${o.state}'));
console.log('stopping == ${myObject.state}');
```

# API Reference

* <a name="defineActionMethods"></a>

## defineActionMethods(object, actionsAndStates, enumerable) ⇒ <code>void</code>
Defines methods to perfom the state transitions.
States are traversed in the following way:
current -> during -> final
If the step is not in one of the transitions current
states and also not already in the transitions final
state a rejecting promise will be delivered from the
generated function. In the 'during' state a function
named '_' + <transitions name> (sample: '_start()')
will be called first.
It is expected that this function delivers a promise.
Special handling of consequent transitions:
While in a during state the former delivered promise will be
delivered again. This enshures that several consequent
transitions in a row will be fullfiled by the same promise.
There can only be one transition in place at a given point in time.

**Kind**: global function  

| Param | Type | Description |
| --- | --- | --- |
| object | <code>object</code> | where we define the metods |
| actionsAndStates | <code>object</code> | object describing the state transitions |
| enumerable | <code>boolean</code> | should the action methods be enumerable defaults to false |


* <a name="BaseMethods.illegalStateTransition"></a>

## BaseMethods.illegalStateTransition(action) ⇒ <code>Promise</code>
Called when state transition action is not allowed

**Kind**: static method of <code>BaseMethods</code>  
**Returns**: <code>Promise</code> - rejecting with an Error  

| Param | Type | Description |
| --- | --- | --- |
| action | <code>object</code> | to be acted on |


* <a name="BaseMethods.stateTransitionRejection"></a>

## BaseMethods.stateTransitionRejection(rejected, newState) ⇒ <code>Promise</code>
Called when the state transtion implementation promise rejects.
Resets the transition

**Kind**: static method of <code>BaseMethods</code>  
**Returns**: <code>Promise</code> - rejecting promise  

| Param | Type | Description |
| --- | --- | --- |
| rejected | <code>object</code> | initiating error |
| newState | <code>string</code> | final state of error |


* <a name="BaseMethods.timeoutForTransition"></a>

## BaseMethods.timeoutForTransition(transition) ⇒ <code>number</code>
Called to get the timeout value for a given transition

**Kind**: static method of <code>BaseMethods</code>  
**Returns**: <code>number</code> - timeout for the transition  

| Param | Type | Description |
| --- | --- | --- |
| transition | <code>object</code> | the transition |


* <a name="BaseMethods.stateChanged"></a>

## BaseMethods.stateChanged(oldState, newState) ⇒ <code>void</code>
To be overwritten
Called when the state changes

**Kind**: static method of <code>BaseMethods</code>  

| Param | Type | Description |
| --- | --- | --- |
| oldState | <code>string</code> | previous state |
| newState | <code>string</code> | new state |


* * *

install
=======

With [npm](http://npmjs.org) do:

```
npm install statetransition-mixin
```


license
=======

BSD-2-Clause
