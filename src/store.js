import {
  always,
  append,
  complement,
  drop,
  F,
  flatten,
  ifElse,
  is,
  map,
  mergeRight,
  objOf,
  pipe,
  prop,
  propEq,
  reduce,
} from 'ramda'
import {
  Bus,
  combineTemplate,
  fromBinder,
  when,
  zipWith,
} from 'baconjs'
import { defaultContextValue } from './context'
import { preReduces, postReduces, defaultValues } from './middleware'

const STATUS_DISPATCH = 'dispatch'
const STATUS_ONHOLD = 'onhold'

const mapPreArgs = (action, state, others) => (
  mergeRight({
    action: action,
    state: state
  },
  others)
)

const mergeNextState = (reducerArgs, nextState) => (
  mergeRight(reducerArgs, {
    nextState: nextState
  })
)

const wrapReducer = (getReducer) => (params) => {
  const pluggable = getReducer(params)
  return {
    input: pluggable.input,
    output: zipWith(pluggable.input, pluggable.output,
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
  return reduce(plugStreams(params),
    // pass action and store states,
    when(reducerArgs, mapPreArgs)
      // merge in the store name.
      .map(mergeRight(params)),
    // to pre-reduce middlewares, reducer then post-reduce.
    flatten([preReduces.get(), wrapReducer(getReducer), postReduces.get()])
  )
  // get the reduced state.
  .map(prop('nextState'))
}

const partialStoreName = (name) => (getter) => (previous) => (
  getter(name, previous)
)

const getDefaultValue = config => {
  const { name, defaultValue } = config

  const getters = map(
    partialStoreName(name),
    defaultValues.get()
  )
  if (defaultValue !== undefined) {
    getters.splice(0, 0, always(defaultValue))
  }

  return (getters.length > 0)
    ? pipe(...getters)(null)
    : null
}

const getStoreProperties = (props, otherStores) => (
  combineTemplate(map(
    store => store.getProperty(props),
    otherStores
  ))
)

const getAccumSeed = () => ({
  status: STATUS_DISPATCH,
  queue: []
})

const shiftFromActionQueue = (accum) => ({
  status: STATUS_DISPATCH,
  queue: drop(1, accum.queue)
})

const pushActionOnhold = (accum, payload) => ({
  status: STATUS_ONHOLD,
  queue: append(payload.action, accum.queue)
})

const pushActionDispatch = (accum, payload) => ({
  status: STATUS_DISPATCH,
  queue: [payload.action]
})

const pushToActionQueue = ifElse(
  // if the action queue is not empty.
  ({ queue }) => queue.length > 0,
  pushActionOnhold,
  pushActionDispatch
)

const accumActionSeed = (getAccumSeed) => {
  let accum = getAccumSeed()
  return {
    clear: () => accum = getAccumSeed(),
    accum: action => accum = (action)
      ? pushToActionQueue(accum, action)
      : shiftFromActionQueue(accum)
  }
}

const isActionQueueOnhold = propEq(
  'status', STATUS_ONHOLD
)

const getFirstActionInQueue = ({ queue }) => (
  queue[0]
)

const createStoreInstance = (getReducer, otherStores) => (config, props) => {
  // store properties.
  const { name } = config
  const storeStream = new Bus()
  const defaultValue = getDefaultValue(config)
  const storeProperty = storeStream.toProperty(defaultValue)
  const otherProperties = getStoreProperties(props, otherStores)
  const dispatcher = getContext(props).dispatcher
  const queue = accumActionSeed(getAccumSeed)

  const actionStream = when(
    [dispatcher.getActionStream()], objOf('action'),
    [storeStream], F,
    [fromBinder(() => queue.clear)], F
  )
  // accumulate actions into a fifo queue.
  .map(queue.accum)
  // filter out when the queue is on hold.
  .filter(complement(isActionQueueOnhold))
  // get the first action object in queue.
  .map(getFirstActionInQueue)
  .filter(is(Object))

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

const getPropertyInstance = ({
  instances,
  config,
  props,
  createInstance,
}) => {
  const { name } = config
  return (name in instances)
    ? instances[name]
    : (instances[name] = createInstance(config, props))
}

const applyConfig = (getConfig, props) => {
  const data = (typeof getConfig === 'function')
    ? getConfig(props)
    : getConfig

  return (data && typeof data === 'object')
    ? data
    : { name: data }
}

const getContext = (props) => (
  (props && props.bdux) || defaultContextValue
)

const subscribeToDispatcher = (props) => {
  const { dispatcher } = getContext(props)
  dispatcher.subscribe()
}

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

const getProperty = (getConfig, createInstance, store) => props => {
  const config = applyConfig(getConfig, props)

  // trigger bacon property action on subscription.
  subscribeToDispatcher(props)
  // either an existing store instance, or initialise the first one.
  return getPropertyInstance({
    instances: getStoreInstances(store, props),
    config,
    props,
    createInstance,
  })
}

const removeProperty = (getConfig, store) => props => {
  const config = applyConfig(getConfig, props)
  if (config.isRemovable) {
    delete getStoreInstances(store, props)[config.name]
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
