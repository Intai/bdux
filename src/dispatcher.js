import {
  cond,
  converge,
  identity,
  ifElse,
  is,
  map,
  mergeRight,
  not,
  objOf,
  pipe,
  T,
  tap,
} from 'ramda'
import { Bus, EventStream, Property } from 'baconjs'
import Common from './utils/common-util'

export const createDispatcher = () => {
  // stream actions from creators to stores.
  const actionStream = new Bus()
  // stream to be triggered on subscription.
  const subscribeStream = new Bus()
  // the latest subscription.
  const subscribeProperty = subscribeStream
    .toProperty({})

  const generateActionId = (() => {
    let id = Common.now() * 1000
    return () => ++id
  })()

  const mergeId = converge(
    mergeRight, [
      pipe(generateActionId, objOf('id')),
      identity
    ]
  )

  const subscribe = () => {
    subscribeStream.push({})
  }

  const plugObservable = (observable) => {
    actionStream.plug(observable)
  }

  const mergeActionId = (observable) => (
    observable
      .filter(is(Object))
      // merge in an action identifier.
      .map(mergeId)
  )

  const combineSubscription = (observable) => (
    observable.combine(subscribeProperty, identity)
  )

  const memoize = (func) => {
    const cached = new WeakMap()
    return (args) => {
      // if hasn't been cached.
      if (!cached.has(args)) {
        // record the key and return value.
        cached.set(args, func(args))
      }
      return cached.get(args)
    }
  }

  const plugEventStream = memoize(pipe(
    mergeActionId,
    plugObservable
  ))

  const plugProperty = memoize(pipe(
    mergeActionId,
    combineSubscription,
    plugObservable
  ))

  const pushAction = (action) => {
    if (is(Object, action)) {
      // merge in an identifier.
      actionStream.push(mergeId(action))
    }
  }

  const dispatchAction = cond([
    [not, identity],
    // plug an observable to flow actions through the dispatcher.
    [is(EventStream), tap(plugEventStream)],
    [is(Property), tap(plugProperty)],
    // push a single action through the dispatcher.
    [T, tap(pushAction)]
  ])

  const wrapActionCreator = (creator) => pipe(
    // call the action creator.
    creator,
    // dispatch the returned action.
    dispatchAction
  )

  const wrapActionCreators = map(
    wrapActionCreator
  )

  const getActionStream = () => (
    actionStream
  )

  const bindToDispatch = ifElse(
    is(Function),
    // wrap to dispatch a single action creator.
    wrapActionCreator,
    // wrap an object of action creators.
    wrapActionCreators
  )

  return {
    generateActionId,
    getActionStream,
    dispatchAction,
    bindToDispatch,
    subscribe
  }
}

export const {
  generateActionId,
  getActionStream,
  dispatchAction,
  bindToDispatch,
  subscribe
} = createDispatcher()
