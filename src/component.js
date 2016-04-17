import R from 'ramda';
import Bacon from 'baconjs';
import React from 'react';
import Common from './utils/common-util';

const getDisplayName = (Component) => (
  Component.displayName || Component.name || 'Component'
);

const subscribe = R.curry((component, store, name) => (
  // subscribe to a store.
  store.getProperty().onValue((state) => {
    // pass its state to the react component.
    component.setState({
      // under the name specified.
      [name]: state
    });
  })
));

const getProperties = R.map(
  R.invoker(0, 'getProperty')
);

const triggerCallbacks = (stores, callbacks) => (
  Bacon.combineTemplate(
    getProperties(stores)
  )
  .first()
  .map(R.of)
  .onValue(R.ap(callbacks))()
);

const pipeFuncs = R.ifElse(
  R.isEmpty,
  R.always(),
  R.apply(R.pipe)
);

export const createComponent = (Component, stores = {}, ...callbacks) => (
  React.createClass({
    displayName: getDisplayName(Component),
    getDefaultProps: () => ({}),
    getInitialState: () => ({}),

    componentWillMount: function() {
      // pipe all dispose functions.
      this.dispose = pipeFuncs(
        // get the array of dispose functions.
        R.values(
          // subscribe to stores.
          R.mapObjIndexed(
            subscribe(this),
            stores)
        )
      );

      // trigger callbacks after subscribing to stores.
      triggerCallbacks(stores, callbacks);
    },

    componentWillUnmount: function() {
      this.dispose();
    },

    render: function() {
      let element = React.createElement(
        Component, R.merge(this.props, this.state));

      // assuming server renders only once.
      if (!Common.canUseDOM()) {
        // unmount after rendering.
        this.componentWillUnmount();
      }

      return element;
    }
  })
);
