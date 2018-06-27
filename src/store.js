import * as R from 'ramda'
import Bacon from 'baconjs'
import { defaultContextValue } from './context'
import { preReduces, postReduces, defaultValues } from './middleware'

const STATUS_DISPATCH = 'dispatch'
const STATUS_ONHOLD = 'onhold'

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
  const pluggable = getReducer()
  return {
    input: pluggable.input,
    output: Bacon.zipWith(pluggable.input, pluggable.output,
      mergeNextState)
  }
}

const plugStreams = (params) => (fromStream, getPluggable) => {
  const pluggable = getPluggable(params)
  pluggable.input.plug(fromStream)
  return pluggable.output
}

const plugPreReducerPost = (name, dispatcher, getReducer, reducerArgs) => {
  const params = {
    name,
    dispatch: dispatcher.dispatchAction,
    bindToDispatch: dispatcher.bindToDispatch
  }

  // pass the store name to middlewares.
  return R.reduce(plugStreams(params),
    // pass action and store states,
    Bacon.when(reducerArgs, mapPreArgs)
      // merge in the store name.
      .map(R.merge(params)),
    // to pre-reduce middlewares, reducer then post-reduce.
    R.flatten([preReduces.get(), wrapReducer(getReducer), postReduces.get()])
  )
  // get the reduced state.
  .map(R.prop('nextState'))
}

const partialStoreName = R.pipe(
  R.of,
  R.flip(R.partial)
)

const getDefaultValue = (name) => {
  const getters = R.map(
    partialStoreName(name),
    defaultValues.get()
  )

  return (getters.length > 0)
    ? R.pipe(...getters)(null)
    : null
}

const getStoreProperties = R.pipe(
  R.map(R.invoker(0, 'getProperty')),
  Bacon.combineTemplate
)

const getAccumSeed = () => ({
  status: STATUS_DISPATCH,
  queue: []
})

const shiftFromActionQueue = (accum) => ({
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
  return {
    clear: () => accum = getAccumSeed(),
    accum: action => accum = accumAction(accum, action)
  }
}

const isActionQueueOnhold = R.propEq(
  'status', STATUS_ONHOLD
)

const getFirstActionInQueue = R.pipe(
  R.prop('queue'),
  R.head
)

const createStoreInstance = (getReducer, otherStores) => (name, dispatcher) => {
  // store properties.
  const storeStream = new Bacon.Bus()
  const defaultValue = getDefaultValue(name)
  const storeProperty = storeStream.toProperty(defaultValue)
  const otherProperties = getStoreProperties(otherStores)
  const queue = accumActionSeed(getAccumSeed)

  const actionStream = Bacon.when(
    [dispatcher.getActionStream()], R.objOf('action'),
    [storeStream], R.F,
    [Bacon.fromBinder(() => queue.clear)], R.F
  )
  // accumulate actions into a fifo queue.
  .map(queue.accum)
  // filter out when the queue is on hold.
  .filter(R.complement(isActionQueueOnhold))
  // get the first action object in queue.
  .map(getFirstActionInQueue)
  .filter(R.is(Object))

  // store name, reducer and
  // an array of action and store states.
  return plugPreReducerPost(
    name,
    dispatcher,
    getReducer, [
      actionStream,
      storeProperty,
      otherProperties
    ]
  )
  // push instead of plug to avoid cyclic subscription.
  .doAction((args) => storeStream.push(args))
  // default store state.
  .toProperty(defaultValue)
}

const getPropertyCreate = (name, instances, dispatcher, createInstance) => {
  const instance = createInstance(name, dispatcher)
  instances[name] = instance
  return instance
}

const getPropertyInstance = R.ifElse(
  R.has,
  R.prop,
  getPropertyCreate
)

const configObject = R.when(
  R.complement(R.is(Object)),
  R.objOf('name')
)

const config = R.ifElse(
  R.is(Function),
  R.pipe(R.call, configObject),
  configObject
)

const getContext = (props) => (
  (props && props.bdux) || defaultContextValue
)

const getStoreInstances = (store, props) => {
  const { stores } = getContext(props)

  if (stores.has(store)) {
    // existing in the context.
    return stores.get(store)
  } else {
    // remember the store in the context.
    const instances = {}
    stores.set(store, instances)
    return instances
  }
}

const getProperty = (getConfig, createInstance, store) => (props) => (
  getPropertyInstance(
    config(getConfig, props).name,
    getStoreInstances(store, props),
    getContext(props).dispatcher,
    createInstance
  )
)

const removeProperty = (getConfig, store) => (props) => {
  const { name, isRemovable } = config(getConfig, props)
  if (isRemovable) {
    delete getStoreInstances(store, props)[name]
  }
}

export const createStore = (getConfig, getReducer, otherStores = {}) => {
  const thisStore = {}
  // get an existing or create a new bacon property to hold the state.
  thisStore.getProperty = getProperty(getConfig,
    createStoreInstance(getReducer, otherStores), thisStore)
  // remove an existing bacon property.
  thisStore.removeProperty = removeProperty(getConfig, thisStore)

  return thisStore
}
