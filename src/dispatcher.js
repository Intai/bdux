import R from 'ramda';
import Bacon from 'baconjs';

// stream actions from creators to stores.
const actionStream = new Bacon.Bus();

const generateId = (() => {
  let id = 0;
  return () => (++id);
})();

const mergeId = R.converge(
  R.merge, [
    R.pipe(generateId, R.objOf('id')),
    R.identity
  ]
);

const plugObservable = (observable) => {
  actionStream.plug(observable
    // merge in an action identifier.
    .map(mergeId));
};

const pushAction = (action) => {
  if (action) {
    // merge in an identifier.
    actionStream.push(mergeId(action));
  }
};

const dispatchAction = R.ifElse(
  R.is(Bacon.Observable),
  // plug an observable to flow actions through the dispatcher.
  plugObservable,
  // push a single action through the dispatcher.
  pushAction
);

const dispatchActionCreator = R.pipe(
  // call the action creator.
  R.call,
  // dispatch the returned action.
  dispatchAction
);

const wrapActionCreator = R.flip(R.wrap)(
  dispatchActionCreator
);

const wrapActionCreators = R.map(
  wrapActionCreator
);

export const getActionStream = () => (
  actionStream
);

export const bindToDispatch = R.ifElse(
  R.is(Function),
  // wrap to dispatch a single action creator.
  wrapActionCreator,
  // wrap an object of action creators.
  wrapActionCreators
);
