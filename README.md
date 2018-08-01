# Bdux

A [Flux](https://github.com/facebook/flux/) architecture implementation out of enjoyment of [Bacon.js](https://baconjs.github.io/), [Redux](http://redux.js.org/) and [React](https://facebook.github.io/react/).

[![Build Status](https://travis-ci.org/Intai/bdux.svg?branch=master)](https://travis-ci.org/Intai/bdux)
[![Coverage Status](https://coveralls.io/repos/github/Intai/bdux/badge.svg?branch=master)](https://coveralls.io/github/Intai/bdux?branch=master)
[![Codacy Badge](https://api.codacy.com/project/badge/Grade/5fa846d4f9a643bea49511814e95f0fc)](https://www.codacy.com/app/intai-hg/bdux?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=Intai/bdux&amp;utm_campaign=Badge_Grade)

## Want to achieve
- Reactive all the way from action to React component.
- Redux style time travel through middleware and reducer.
- Only activate reducer when there is a subscriber.
- Utilise stateless functional React component.
- Utilise React context provider and consumer.

## Installation
To install as an [npm](https://www.npmjs.com/) package:
```sh
npm install --save bdux
```

## Action
Action creator returns:
- A single action object.
- A Bacon stream of action objects.
- A falsy value to create no action.

Example of action creators:
```javascript
import Bacon from 'baconjs'
import ActionTypes from './action-types'

export const add = () => ({
  type: ActionTypes.ADD
})

export const complete = () => (
  Bacon.once({
    type: ActionTypes.COMPLETE
  })
)

export const remove = (index) => {
  if (index >= 0) {
    return {
      type: ActionTypes.REMOVE
    }
  }
}
```

## Store
Store is created using `createStore(name, getReducer, otherStores = {})`.
- `name` specifies a unique store name, which can be:
  - A string.
  - A function `props => ({ name })`.
- `getReducer` returns a reducer as `Pluggable` which is an object contains the input and output of a stream.
- `otherStores` is an object of dependent stores.

Reducer stream:
- Receives an input object `{ action, state, dispatch, bindToDispatch, ...dependencies }`.
- Should always output the next state according purely on the input object.
- Should **NOT** have intermediate state. e.g. `scan` or `skipDuplicates`.
- Should **NOT** have side effect. e.g. `flatMap` or `throttle`.

Have intermediate states and side effects in action creators instead. So time travelling can be achieved, and there is a single point to monitor all actions which could cause state changes. Store can dispatch actions which will be queued to cause state changes in other stores.

Example of a store:
```javascript
import R from 'ramda'
import Bacon from 'baconjs'
import ActionTypes from '../actions/action-types'
import StoreNames from '../stores/store-names'
import { createStore } from 'bdux'

const isAction = R.pathEq(
  ['action', 'type']
)

const whenCancel = R.when(
  isAction(ActionTypes.CANCEL),
  R.assocPath(['state', 'confirm'], false)
)

const whenConfirm = R.when(
  isAction(ActionTypes.CONFIRM),
  R.assocPath(['state', 'confirm'], true)
)

const getOutputStream = (reducerStream) => (
  reducerStream
    .map(whenCancel)
    .map(whenConfirm)
    .map(R.prop('state'))
)

export const getReducer = () => {
  const reducerStream = new Bacon.Bus()

  return {
    input: reducerStream,
    output: getOutputStream(reducerStream)
  }
}

export default createStore(
  StoreNames.DIALOG, getReducer
)
```

Dealing with a collection of data is a common and repetitive theme for store. Creating a separate store for the items in the collection can be a great tool for the scenario. Simply construct the store names dynamically from `props` for individual items.

Example of constrcuting store names:
```javascript
const getInstance = (props) => ({
  name: `${StoreNames.PRODUCT}_${props.productId}`,

  // mark the store instance as removable
  // to be removed on component unmount.
  isRemovable: true
})

export default createStore(
  getInstance, getReducer
)
```

## Component
Component with dependent stores can be created using `createComponent(Componenet, stores = {}, ...callbacks)` or `createComponent(stores = {}, ...callbacks)(Componenet)`.
- `Component` is a React component.
- `stores` is an object of dependent stores.
- `callbacks` are functions to be triggered after subscribing to stores.

Additional props are passed to `Component`:
- `dispatch` the return value of an action creator.
- `bindToDispatch` binds a single action creator or an object of action creators to dispatch actions to stores.

Example of a component:
```javascript
import R from 'ramda'
import React from 'react'
import * as CountDownAction from '../actions/countdown-action'
import CountDownStore from '../stores/countdown-store'
import { createComponent } from 'bdux'

const handleDoubleClick = ({ dispatch }) => () => {
  dispatch(CountDownAction.doubleClick())
}

export const CountDown = (props) => (
  R.is(Number, props.countdown) && (
    <button
      onClick={ props.bindToDispatch(CountDownAction.click) }
      onDoubleClick={ handleDoubleClick(props) }
    >
      { props.countdown }
    </button>
  )
)

export default createComponent(CountDown, {
  countdown: CountDownStore
},
// start counting down.
CountDownAction.countdown)
```

Wrap the entire app in a bdux context provider optionally to avoid of using global dispatcher and stores, which is very useful for server side rendering to isolate requests.
```javascript
import React from 'react'
import ReactDOM from 'react-dom'
import { BduxContext, createDispatcher } from 'bdux'
import App from './components/app'

const bduxContext = {
  dispatcher: createDispatcher(),
  stores: new WeakMap()
}

const renderApp = () => (
  <BduxContext.Provider value={bduxContext}>
    <App />
  </BduxContext.Provider>
)

ReactDOM.render(
  renderApp(),
  document.getElementById('app')
)
```

## Middleware
Middleware exports `getPreReduce`, `getPostReduce` and `decorateComponent` optionally.
- `getPreReduce` returns a `Pluggable` stream to be applied before all reducers.
- `getPostReduce` returns a `Pluggable` stream to be applied after reducers.
- `decorateComponent` decorates all components created by `createComponent`.

Example of a middleware:
```javascript
import Bacon from 'baconjs'

const logPreReduce = ({ action }) => {
  console.log('before reducer')
}

const logPostReduce = ({ nextState }) => {
  console.log('after reducer')
}

export const getPreReduce = (/*{ name, dispatch, bindToDispatch }*/) => {
  const preStream = new Bacon.Bus()

  return {
    input: preStream,
    output: preStream
      .doAction(logPreReduce)
  }
}

export const getPostReduce = () => {
  const postStream = new Bacon.Bus()

  return {
    input: postStream,
    output: postStream
      .doAction(logPostReduce)
  }
}
```

## Apply middleware
Middleware should be configured before importing any store.

Example of applying middlewares:
```javascript
import * as Logger from 'bdux-logger'
import * as Timetravel from 'bdux-timetravel'
import { applyMiddleware } from 'bdux'

applyMiddleware(
  Timetravel,
  Logger
)
```

## Examples
- [Countdown](https://github.com/Intai/bdux-examples/tree/master/countdown)
- [Router](https://github.com/Intai/bdux-examples/tree/master/react-router)
- [Universal](https://github.com/Intai/bdux-examples/tree/master/universal)
- [Async](https://github.com/Intai/bdux-examples/tree/master/async)
- [Native](https://github.com/Intai/bdux-examples/tree/master/native)
- [Infinite Scroll](https://github.com/Intai/bdux-examples/tree/master/infinite-scroll)

## License
[The ISC License](./LICENSE.md)
