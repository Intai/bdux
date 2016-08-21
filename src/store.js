import R from 'ramda'
import Bacon from 'baconjs'
import { getActionStream } from './dispatcher'

const STATUS_DISPATCH = 'dispatch'
const STATUS_ONHOLD = 'onhold'

const hasMiddlewareType = (type, middleware) => (
  middleware && R.is(Function, middleware[type])
)

const appendMiddlewareByType = R.converge(
  R.append, [
    R.prop,
    R.nthArg(2)
  ]
)

const appendMiddleware = R.curryN(3,
  R.ifElse(
    hasMiddlewareType,
    appendMiddlewareByType,
    R.nthArg(2)
  )
)

const createCollection = (append) => {
  let array = []

  return {
    get: () => array,
    append: (middleware) => array = append(middleware, array),
    clear: () => array = []
  }
}

// pluggables before store reducer.
const preReduces = createCollection(
  appendMiddleware('getPreReduce')
)

// pluggables after store reducer.
const postReduces = createCollection(
  appendMiddleware('getPostReduce')
)

const appendPrePostReduce = R.juxt([
  preReduces.append,
  postReduces.append
])

const mapPreArgs = (action, state, others) => (
  R.merge({
    action: action,
    state: state
  },
  others)
)

const mergeNextState = (reducerArgs, nextState) => (
  R.merge(reducerArgs, {
    nextState: nextState
  })
)

const wrapReducer = (getReducer) => () => {
  let pluggable = getReducer()
  return {
    input: pluggable.input,
    output: Bacon.zipWith(pluggable.input, pluggable.output,
      mergeNextState)
  }
}

const plugStreams = R.curry((name, fromStream, getPluggable) => {
  let pluggable = getPluggable(name)
  pluggable.input.plug(fromStream)
  return pluggable.output
})

const plugPreReducerPost = (name, getReducer, reducerArgs) => (
  // pass the store name to middlewares.
  R.reduce(plugStreams(name),
    // pass action and store states,
    Bacon.when(reducerArgs, mapPreArgs)
      // merge in the store name.
      .map(R.merge({ name: name })),
    // to pre-reduce middlewares, reducer then post-reduce.
    R.flatten([preReduces.get(), wrapReducer(getReducer), postReduces.get()])
  )
  // get the reduced state.
  .map(R.prop('nextState'))
)

const getStoreProperties = R.pipe(
  R.map(R.invoker(0, 'getProperty')),
  Bacon.combineTemplate
)

const getAccumSeed = () => ({
  status: STATUS_DISPATCH,
  queue: []
})

const shiftFromActionQueue = (accum, payload) => ({
  status: STATUS_DISPATCH,
  queue: R.drop(1, accum.queue)
})

const pushActionOnhold = (accum, payload) => ({
  status: STATUS_ONHOLD,
  queue: R.append(payload.action, accum.queue)
})

const pushActionDispatch = (accum, payload) => ({
  status: STATUS_DISPATCH,
  queue: [payload.action]
})

const pushToActionQueue = R.ifElse(
  // if the action queue is not empty.
  R.pipe(R.prop('queue'), R.length, R.lt(0)),
  pushActionOnhold,
  pushActionDispatch
)

const accumAction = R.ifElse(
  R.nthArg(1),
  pushToActionQueue,
  shiftFromActionQueue
)

const accumActionSeed = (getAccumSeed) => {
  let accum = getAccumSeed()
  return (action) => (
    accum = accumAction(accum, action)
  )
}

const isActionQueueOnhold = R.propEq(
  'status', STATUS_ONHOLD
)

const getFirstActionInQueue = R.pipe(
  R.prop('queue'),
  R.head
)

export const applyMiddleware = (...args) => {
  // loop through an array of middlewares.
  R.forEach(appendPrePostReduce, args)
}

export const clearMiddlewares = R.juxt([
  preReduces.clear,
  postReduces.clear
])

export const getMiddlewares = R.converge(
  R.merge, [
    R.pipe(preReduces.get, R.clone, R.objOf('preReduces')),
    R.pipe(postReduces.get, R.clone, R.objOf('postReduces'))
  ]
)

export const createStore = (name, getReducer, otherStores = {}) => {
  // store properties.
  let storeStream = new Bacon.Bus(),
      storeProperty = storeStream.toProperty(null),
      otherProperties = getStoreProperties(otherStores)

  const actionStream = Bacon.when(
    [getActionStream()], R.objOf('action'),
    [storeStream], R.F
  )
  // accumulate actions into a fifo queue.
  .map(accumActionSeed(getAccumSeed))
  // filter out when the queue is on hold.
  .filter(R.complement(isActionQueueOnhold))
  // get the first action object in queue.
  .map(getFirstActionInQueue)
  .filter(R.is(Object))

  // store name, reducer and
  // an array of action and store states.
  const reducedProperty = plugPreReducerPost(
    name,
    getReducer, [
      actionStream,
      storeProperty,
      otherProperties
    ]
  )
  // push instead of plug to avoid cyclic subscription.
  .doAction((args) => storeStream.push(args))
  // default store state.
  .toProperty(null)

  return {
    getProperty: () => reducedProperty
  }
}
