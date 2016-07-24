import R from 'ramda';
import Bacon from 'baconjs';
import { getActionStream } from './dispatcher'

const STATUS_DISPATCH = 'dispatch'
const STATUS_ONHOLD = 'onhold'

const hasMiddlewareType = (concat, type, middleware) => (
  R.is(Function, middleware[type])
);

const concatMiddlewareByType = (concat, type, middleware) => (
  concat(middleware[type])
);

const concatMiddleware = R.cond([
  [R.complement(R.nthArg(2)), R.F],
  [hasMiddlewareType, concatMiddlewareByType]
]);

// pluggables before store reducer.
const preReduces = (() => {
  let array = [];
  return (middleware) => (
    array = concatMiddleware(
      R.concat(array), 'getPreReduce', middleware) || array
  );
})();

// pluggables after store reducer.
const postReduces = (() => {
  let array = [];
  return (middleware) => (
    array = concatMiddleware(
      R.concat(array), 'getPostReduce', middleware) || array
  );
})();

const setPrePostReduce = R.pipe(
  R.tap(preReduces),
  postReduces
);

const mapPreArgs = (...args) => (
  R.merge({
    action: args[0],
    state: args[1]
  },
  args[2])
);

const mergeNextState = (reducerArgs, nextState) => (
  R.merge(reducerArgs, {
    nextState: nextState
  })
);

const wrapReducer = (getReducer) => (() => {
  let pluggable = getReducer();
  return {
    input: pluggable.input,
    output: pluggable.input.toProperty({})
      .sampledBy(pluggable.output, mergeNextState)
  }
});

const plugStreams = R.curry((name, fromStream, getPluggable) => {
  let pluggable = getPluggable(name);
  pluggable.input.plug(fromStream);
  return pluggable.output;
});

const plugPreReducerPost = (name, getReducer, reducerArgs) => (
  // pass the store name to middlewares.
  R.reduce(plugStreams(name),
    // pass action and store states,
    Bacon.when(reducerArgs, mapPreArgs)
      // merge in the store name.
      .map(R.merge({ name: name })),
    // to pre-reduce middlewares, reducer then post-reduce.
    R.flatten([preReduces(), wrapReducer(getReducer), postReduces()])
  )
  // get the reduced state.
  .map(R.prop('nextState'))
);

const getStoreProperties = R.pipe(
  R.map(R.invoker(0, 'getProperty')),
  Bacon.combineTemplate
);

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

const isActionQueueOnhold = R.propEq(
  'status', STATUS_ONHOLD
)

const getFirstActionInQueue = R.pipe(
  R.prop('queue'),
  R.head
)

export const applyMiddleware = (...args) => {
  // loop through an array of middlewares.
  R.forEach(setPrePostReduce, args);
};

export const createStore = (name, getReducer, otherStores = {}) => {
  // store properties.
  let storeStream = new Bacon.Bus(),
      storeProperty = storeStream.toProperty(null),
      otherProperties = getStoreProperties(otherStores);

  const actionStream = Bacon.when(
    [getActionStream()], R.objOf('action'),
    [storeStream], R.F
  )
  // accumulate actions into a filo queue.
  .scan(getAccumSeed(), accumAction)
  // filter out when the queue is on hold.
  .filter(R.complement(isActionQueueOnhold))
  // get the first action object in queue.
  .map(getFirstActionInQueue)
  .filter(R.is(Object))
  .changes()

  storeStream.plug(
    // store name, reducer and
    // an array of action and store states.
    plugPreReducerPost(name, getReducer, [
      actionStream,
      storeProperty,
      otherProperties
    ])
  );

  return {
    getProperty: () => storeProperty
  };
};
