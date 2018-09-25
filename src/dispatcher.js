import * as R from 'ramda'
import Bacon from 'baconjs'
import Common from './utils/common-util'

export const createDispatcher = () => {
  // stream actions from creators to stores.
  const actionStream = new Bacon.Bus()
  // stream to be triggered on subscription.
  const subscribeStream = new Bacon.Bus()
  // the latest subscription.
  const subscribeProperty = subscribeStream
    .toProperty({})

  const generateActionId = (() => {
    let id = Common.now() * 1000
    return () => ++id
  })()

  const mergeId = R.converge(
    R.merge, [
      R.pipe(generateActionId, R.objOf('id')),
      R.identity
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
      .filter(R.is(Object))
      // merge in an action identifier.
      .map(mergeId)
  )

  const combineSubscription = (observable) => (
    observable.combine(subscribeProperty, R.identity)
  )

  const plugEventStream = R.pipe(
    mergeActionId,
    plugObservable
  )

  const plugProperty = R.pipe(
    mergeActionId,
    combineSubscription,
    plugObservable
  )

  const pushAction = (action) => {
    if (R.is(Object, action)) {
      // merge in an identifier.
      actionStream.push(mergeId(action))
    }
  }

  const dispatchAction = R.cond([
    [R.not, R.identity],
    // plug an observable to flow actions through the dispatcher.
    [R.is(Bacon.EventStream), R.tap(plugEventStream)],
    [R.is(Bacon.Property), R.tap(plugProperty)],
    // push a single action through the dispatcher.
    [R.T, R.tap(pushAction)]
  ])

  const wrapActionCreator = (creator) => R.pipe(
    // call the action creator.
    creator,
    // dispatch the returned action.
    dispatchAction
  )

  const wrapActionCreators = R.map(
    wrapActionCreator
  )

  const getActionStream = () => (
    actionStream
  )

  const bindToDispatch = R.ifElse(
    R.is(Function),
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
