import R from 'ramda';
import React from 'react';

const getDisplayName = (Component) => (
  Component.displayName || Component.name || 'Component'
);

const subscribe = (component, store, name) => (
  // subscribe to a store.
  store.getProperty().onValue((state) => {
    // pass its state to the react component.
    component.setState({
      // under the name specified.
      [name]: state
    });
  })
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
            R.curry(subscribe)(this),
            stores)
        )
      );

      // trigger callbacks after subscribing to stores.
      pipeFuncs(callbacks)();
    },

    componentWillUnmount: function() {
      this.dispose();
    },

    render: function() {
      return React.createElement(
        Component, R.merge(this.props, this.state));
    }
  })
);
