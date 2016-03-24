Bdux
=======

A [Flux](https://github.com/facebook/flux/) architecture implementation out of enjoyment of [Bacon.js](https://baconjs.github.io/), [Redux](http://redux.js.org/) and [React](https://facebook.github.io/react/).

## Want to achieve
- Reactive all the way from action to React component.
- Redux time travel through middleware and reducer.
- Utilise stateless functional React component.

## Installation
To install as an [npm](https://www.npmjs.com/) package:
```
npm install --save bdux
```

## Action
Action creator returns:
- A single action object.
- A Bacon stream of action objects.
- A falsy value to create no action.

Then `bindToDispatch` binds a single action creator or an object of action creators to dispatch actions to stores.

Example of action creators:
```
import ActionTypes from './action-types';
import { bindToDispatch } from 'bdux';

export const add = () => ({
  type: ActionTypes.ADD
});

export const complete = () => (
  Bacon.once({
    type: ActionTypes.COMPLETE
  })
);

export const remove = (index) => {
  if (index >= 0) {
    return {
      type: ActionTypes.REMOVE
    };
  }
};

export default bindToDispatch({
  add,
  complete
  remove
});
```

## Store
## Component
