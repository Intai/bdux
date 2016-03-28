# Bdux

A [Flux](https://github.com/facebook/flux/) architecture implementation out of enjoyment of [Bacon.js](https://baconjs.github.io/), [Redux](http://redux.js.org/) and [React](https://facebook.github.io/react/).

## Want to achieve
- Reactive all the way from action to React component.
- Redux time travel through middleware and reducer.
- Utilise stateless functional React component.

## Installation
To install as an [npm](https://www.npmjs.com/) package:
```
npm install --save bdux
```

## Action
Action creator returns:
- A single action object.
- A Bacon stream of action objects.
- A falsy value to create no action.

Then `bindToDispatch` binds a single action creator or an object of action creators to dispatch actions to stores.

Example of action creators:
``` javascript
import ActionTypes from './action-types';
import { bindToDispatch } from 'bdux';

export const add = () => ({
  type: ActionTypes.ADD
});

export const complete = () => (
  Bacon.once({
    type: ActionTypes.COMPLETE
  })
);

export const remove = (index) => {
  if (index >= 0) {
    return {
      type: ActionTypes.REMOVE
    };
  }
};

export default bindToDispatch({
  add,
  complete
  remove
});
```

## Store
Store is created using `createStore(name, getReducer)`.
- `name` is a unique store name.
- `getReducer` returns a reducer as `Pluggable` which is an object contains the input and output of a stream.

Reducer stream:
- Receives an input object `{ action, state, ...dependencies }`.
- Should output the next state according purely on the input object.
- Should **NOT** have intermediate state. e.g. `scan` or `skipDuplicates`.
- Should **NOT** have side effect. e.g. `flatMap` or `throttle`.

Have intermediate states and side effects in action creators instead. So time travelling can be achieved, and there is a single point to monitor all actions which could cause state changes.

Example of a store:
``` javascript
import R from 'ramda';
import Bacon from 'baconjs';
import ActionTypes from '../actions/action-types';
import StoreNames from '../stores/store-names';
import { createStore } from 'bdux';

const isAction = R.pathEq(
  ['action', 'type']
);

const mergeState = (name, getValue) => (
  R.converge(R.mergeWith(R.merge), [
    R.identity,
    R.pipe(
      getValue,
      R.objOf(name),
      R.objOf('state')
    )
  ])
);

const whenCancel = R.when(
  isAction(ActionTypes.CANCEL),
  mergeState('confirm', R.always(false))
);

const whenConfirm = R.when(
  isAction(ActionTypes.CONFIRM),
  mergeState('confirm', R.always(true))
);

const getOutputStream = (reducerStream) => (
  reducerStream
    .map(whenCancel)
    .map(whenConfirm)
    .map(R.prop('state'))
);

export const getReducer = () => {
  let reducerStream = new Bacon.Bus();

  return {
    input: reducerStream,
    output: getOutputStream(reducerStream)
  };
};

export default createStore(
  StoreNames.DIALOG, getReducer
);
```

## Component
Component with dependent stores can be created using `createComponent(Componenet, stores, ...callbacks)`.
- `Component` is a React component.
- `stores` is an object of dependent stores.
- `callbacks` are functions to be triggered after subscribing to stores.

Example of a component:
``` javascript
import R from 'ramda';
import React from 'react';
import CountDownAction from '../actions/countdown-action';
import CountDownStore from '../stores/countdown-store';
import { createComponent } from 'bdux'

const renderCountDown = (countdown) => (
  <span>{ countdown }</span>
);

const render = R.ifElse(
  R.is(Number),
  renderCountDown,
  R.always(<noscript />)
);

export const CountDown = ({ countdown }) => (
  render(countdown)
);

export default createComponent(CountDown, {
  countdown: CountDownStore
},
// start counting down.
CountDownAction.countdown);
```

## Middleware
Middleware exports `getPreReduce` and `getPostReduce` optionally.
- `getPreReduce` returns a `Pluggable` stream to be applied before all reducers.
- `getPostReduce` returns a `Pluggable` stream to be applied after reducers.

Example of a middleware:
``` javascript
import Bacon from 'baconjs';

const logPreReduce = ({ action }) => {
  console.log('before reducer');
};

const logPostReduce = ({ nextState }) => {
  console.log('after reducer');
};

export const getPreReduce = () => {
  let preStream = new Bacon.Bus();

  return {
    input: preStream,
    output: preStream
      .doAction(logPreReduce)
  };
};

export const getPostReduce = () => {
  let postStream = new Bacon.Bus();

  return {
    input: postStream,
    output: postStream
      .doAction(logPostReduce)
  };
};
```

## Apply middleware
Middleware should be configured before importing any store.

Example of applying middlewares:
``` javascript
import * as Logger from 'bdux-logger';
import * as Timetravel from 'bdux-timetravel';
import { applyMiddleware } from 'bdux';

applyMiddleware(
  Timetravel,
  Logger
);
```

## Examples
- [Countdown](https://github.com/Intai/bdux-examples/tree/master/countdown)
- [Router](https://github.com/Intai/bdux-examples/tree/master/react-router)

## License
[The ISC License](./LICENSE.md)
