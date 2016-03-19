import R from 'ramda';
import Bacon from 'baconjs';
import { getActionStream } from './dispatcher'

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

const mapPostArgs = (...args) => (
  R.merge({
    action: args[1],
    state: args[2],
    nextState: args[0]
  },
  args[3])
);

const plugStreams = (fromStream, getPluggable) => {
  let pluggable = getPluggable();
  pluggable.input.plug(fromStream);
  return pluggable.output;
};

const plugPreAndReducer = (name, getReducer, reducerArgs) => {
  let reducedStream = R.reduce(plugStreams,
    // pass action and store states,
    Bacon.when(reducerArgs, mapPreArgs)
      // merge in the store name.
      .map(R.merge({ name: name })),
    // to pre-reduce middlewares and reducer.
    R.flatten([preReduces(), getReducer])
  );

  return [name,
    // turn action stream to property to be sampled.
    R.concat([reducedStream, reducerArgs[0].toProperty({})],
      // store properties.
      R.slice(1, Infinity, reducerArgs))];
};

const plugPostReduce = ([name, reducerArgs]) => (
  R.reduce(plugStreams,
    // pass information to post-reduce middleware.
    Bacon.when(reducerArgs, mapPostArgs)
      // merge in the store name.
      .map(R.merge({ name: name })),
    // to post-reduce middlewares.
    postReduces()
  )
  // get the reduced state.
  .map(R.prop('nextState'))
);

const getStoreProperties = R.pipe(
  R.map(R.invoker(0, 'getProperty')),
  Bacon.combineTemplate
);

export const applyMiddleware = (...args) => {
  // loop through an array of middlewares.
  R.forEach(setPrePostReduce, args);
};

export const createStore = (name, getReducer, otherStores = {}) => {
  let storeStream = new Bacon.Bus(),
      storeProperty = storeStream.toProperty(null),
      otherProperties = getStoreProperties(otherStores),
      reducerArgs = [getActionStream(), storeProperty, otherProperties];

  storeStream.plug(
    R.pipe(
      plugPreAndReducer,
      plugPostReduce
    // store name and reducer.
    // an array of action and store states.
    )(name, getReducer, reducerArgs)
  );

  return {
    getProperty: () => storeProperty
  };
};
