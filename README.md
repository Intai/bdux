Bdux
=======

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
