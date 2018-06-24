import * as R from 'ramda'
import Bacon from 'baconjs'
import Common from './utils/common-util'

export const createDispatcher = () => {
  // stream actions from creators to stores.
  const actionStream = new Bacon.Bus()

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

  const plugObservable = (observable) => {
    actionStream.plug(observable
      .filter(R.is(Object))
      // merge in an action identifier.
      .map(mergeId))
  }

  const pushAction = (action) => {
    if (R.is(Object, action)) {
      // merge in an identifier.
      actionStream.push(mergeId(action))
    }
  }

  const dispatchAction = R.cond([
    [R.not, R.identity],
    // plug an observable to flow actions through the dispatcher.
    [R.is(Bacon.Observable), R.tap(plugObservable)],
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
    bindToDispatch
  }
}

export const {
  generateActionId,
  getActionStream,
  dispatchAction,
  bindToDispatch
} = createDispatcher()
