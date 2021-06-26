# Bdux

A [Flux](https://github.com/facebook/flux/) architecture implementation out of enjoyment of [Bacon.js](https://baconjs.github.io/), [Redux](http://redux.js.org/) and [React](https://facebook.github.io/react/).

[![Build Status](https://travis-ci.com/Intai/bdux.svg?branch=master)](https://travis-ci.com/Intai/bdux)
[![Coverage Status](https://coveralls.io/repos/github/Intai/bdux/badge.svg?branch=master)](https://coveralls.io/github/Intai/bdux?branch=master)
[![Codacy Badge](https://app.codacy.com/project/badge/Grade/ddd525f402f149d083a44c22ed0f3317)](https://www.codacy.com/gh/Intai/bdux/dashboard?utm_source=github.com&amp;utm_medium=referral&amp;utm_content=Intai/bdux&amp;utm_campaign=Badge_Grade)

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
Component can subscribe to dependent stores using hooks `useBdux(props, stores = {}, callbacks = [], skipDuplicates)` or `createUseBdux(stores = {}, callbacks = [], skipDuplicates)(props)`.
- `stores` is an object of dependent stores.
- `callbacks` is any array of functions to be triggered after subscribing to stores.
- `skipDuplicates` is a function to map store properties. The default behaviour is `map(property => property.skipDuplicates())`.

The hooks return an object of:
- `state` is an object of the current values of stores.
- `dispatch` is a function to dispatch the return value of an action creator to stores.
- `bindToDispatch` binds a single action creator or an object of action creators to dispatch actions to stores.

Example of a component:
```javascript
import R from 'ramda'
import React, { useMemo, useCallback } from 'react'
import * as CountDownAction from '../actions/countdown-action'
import CountDownStore from '../stores/countdown-store'
import { createUseBdux } from 'bdux'

const useBdux = createUseBdux({
  countdown: CountDownStore
}, [
  // start counting down.
  CountDownAction.countdown
])

const CountDown = (props) => {
  const { state, dispatch, bindToDispatch } = useBdux(props)

  const handleClick = useMemo(() => (
    bindToDispatch(CountDownAction.click)
  ), [bindToDispatch])

  const handleDoubleClick = useCallback(() => {
    dispatch(CountDownAction.doubleClick())
  }, [dispatch])

  return R.is(Number, state.countdown) && (
    <button
      onClick={ handleClick }
      onDoubleClick={ handleDoubleClick }
    >
      { state.countdown }
    </button>
  )
}

export default React.memo(CountDown)
```

Wrap the entire app in a bdux context provider optionally to avoid of using global dispatcher and stores, which is also useful for server side rendering to isolate requests.
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
Middleware exports `getPreReduce`, `getPostReduce` and `useHook` optionally.
- `getPreReduce` returns a `Pluggable` stream to be applied before all reducers.
- `getPostReduce` returns a `Pluggable` stream to be applied after reducers.
- `useHook` is triggered in all components which include `useBdux`.

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
