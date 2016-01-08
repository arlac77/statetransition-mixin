statetransition-mixin
=====================

[![npm](https://img.shields.io/npm/v/statetransition-mixin.svg)](https://www.npmjs.com/package/statetransition-mixin)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/arlac77/statetransition-mixin)
[![Build Status](https://secure.travis-ci.org/arlac77/statetransition-mixin.png)](http://travis-ci.org/arlac77/statetransition-mixin)
[![bithound](https://www.bithound.io/github/arlac77/statetransition-mixin/badges/score.svg)](https://www.bithound.io/github/arlac77/statetransition-mixin)
[![Coverage Status](https://coveralls.io/repos/arlac77/statetransition-mixin/badge.svg)](https://coveralls.io/r/arlac77/statetransition-mixin)
[![Code Climate](https://codeclimate.com/github/arlac77/statetransition-mixin/badges/gpa.svg)](https://codeclimate.com/github/arlac77/statetransition-mixin)
[![GitHub Issues](https://img.shields.io/github/issues/arlac77/statetransition-mixin.svg?style=flat-square)](https://github.com/arlac77/statetransition-mixin/issues)
[![Dependency Status](https://david-dm.org/arlac77/statetransition-mixin.svg)](https://david-dm.org/arlac77/statetransition-mixin)
[![devDependency Status](https://david-dm.org/arlac77/statetransition-mixin/dev-status.svg)](https://david-dm.org/arlac77/statetransition-mixin#info=devDependencies)
[![docs](http://inch-ci.org/github/arlac77/statetransition-mixin.svg?branch=master)](http://inch-ci.org/github/arlac77/statetransition-mixin)
[![downloads](http://img.shields.io/npm/dm/statetransition-mixin.svg?style=flat-square)](https://npmjs.org/package/statetransition-mixin)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)


![start stop transition example](doc/start-stop.png)

usage
=====

```javascript
const stm = require('statetranstion-mixin');

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

for es6 classes to
------------------

```javascript
const stm = require('statetranstion-mixin');

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

myObject = new StatefullClass();

console.log(myObject.state === 'stopped' ? "is stopped" : "hmm ?")

myObject.start().then( (o) => console.log('started == ${o.state}'));
console.log('starting == ${myObject.state}');

myObject.stop().then( (o) => console.log('stopped == ${o.state}'));
console.log('stopping == ${myObject.state}');

```

install
=======

With [npm](http://npmjs.org) do:

```
npm install statetransition-mixin
```

license
=======

BSD-2-Clause
