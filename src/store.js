import R from 'ramda'
import Bacon from 'baconjs'
import { getActionStream } from './dispatcher'
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

const getDefaultValue = () => {
  const getters = defaultValues.get()
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

const createStoreInstance = R.curry((getReducer, otherStores, name) => {
  // store properties.
  let storeStream = new Bacon.Bus(),
      defaultValue = getDefaultValue(),
      storeProperty = storeStream.toProperty(defaultValue),
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
  return plugPreReducerPost(
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
  .toProperty(defaultValue)
})

const getPropertyExisting = (name, instances) => [
  instances,
  R.prop(name, instances)
]

const getPropertyCreate = (name, instances, createInstance) => {
  const instance = createInstance(name)
  return [
    R.assoc(name, instance, instances),
    instance
  ]
}

const getPropertyInstance = R.ifElse(
  R.has,
  getPropertyExisting,
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

const getProperty = R.curry((getConfig, createInstance, props, instances) => {
  const { name } = config(getConfig, props)
  return getPropertyInstance(name, instances, createInstance)
})

const removeProperty = R.curry((getConfig, props, instances) => {
  const { name, isRemovable } = config(getConfig, props)
  return [(isRemovable)
    ? R.dissoc(name, instances)
    : instances
  ]
})

const memoizeStore = (funcs) => {
  let ret, instances = {}
  return R.map((func) => (props) => {
    [instances, ret] = func(props, instances)
    return ret
  }, funcs)
}

export const createStore = (getConfig, getReducer, otherStores = {}) => {
  return memoizeStore({
    getProperty: getProperty(getConfig, createStoreInstance(getReducer, otherStores)),
    removeProperty: removeProperty(getConfig)
  })
}
