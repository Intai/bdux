import R from 'ramda'
import Bacon from 'baconjs'
import React from 'react'
import Common from './utils/common-util'

const getDisplayName = (Component) => (
  Component.displayName || Component.name || 'Component'
)

const subscribe = R.curry((component, store, name) => (
  // subscribe to a store.
  store.getProperty(component.props).onValue((state) => {
    // pass its state to the react component.
    component.setState({
      // under the name specified.
      [name]: state
    })
  })
))

const getProperties = R.uncurryN(2, (component) => R.map(
  R.invoker(1, 'getProperty')(component.props)
))

const triggerCallbacks = (component, stores, callbacks) => (
  Bacon.combineTemplate(
    R.assoc('props', component.props,
      getProperties(component, stores))
  )
  .first()
  .map(R.of)
  .onValue(R.ap(callbacks))()
)

const hasFuncs = R.allPass([
  R.is(Array),
  R.complement(R.isEmpty)
])

const pipeFuncs = R.ifElse(
  hasFuncs,
  R.apply(R.pipe),
  R.always(R.F)
)

const removeStores = R.uncurryN(2, (component) => R.forEachObjIndexed((store) => {
  store.removeProperty(component.props)
}))

export const createComponent = (Component, stores = {}, ...callbacks) => (
  class extends React.Component {
    static displayName = getDisplayName(Component)
    static defaultProps = {}
    state = {}

    /* istanbul ignore next */
    constructor() {
      super()
    }

    componentWillMount() {
      // pipe all dispose functions.
      this.dispose = pipeFuncs(
        // get the array of dispose functions.
        R.values(
          // subscribe to stores.
          R.mapObjIndexed(
            subscribe(this),
            stores)
        )
      )

      // trigger callbacks after subscribing to stores.
      triggerCallbacks(this, stores, callbacks)
    }

    componentWillUnmount() {
      this.dispose()
      removeStores(this, stores)
    }

    render() {
      const element = React.createElement(
        Component, R.merge(this.props, this.state))

      // assuming server renders only once.
      if (Common.isOnServer()) {
        // unmount after rendering.
        this.componentWillUnmount()
      }

      return element
    }
  }
)
