import * as R from 'ramda'
import Bacon from 'baconjs'
import React from 'react'
import Common from './utils/common-util'
import BduxContext from './context'
import { decorators } from './middleware'

const getDisplayName = (Component) => (
  Component.displayName || Component.name || 'Component'
)

const getDispatch = R.pathOr(
  R.F, ['dispatcher', 'dispatchAction']
)

const getBindToDispatch = R.pathOr(
  R.identity, ['dispatcher', 'bindToDispatch']
)

const subscribe = R.curry((component, store, name) => (
  // subscribe to a store.
  store.getProperty(component.props)
    // todo: workaround baconjs v2 bug causing onValue to be not synchronous.
    .doAction(state => {
      const update = {
        // under the name specified.
        [name]: state
      }

      // pass its state update to the react component.
      if (!component.isConstructed) {
        component.state = update;
      } else {
        component.setState(update)
      }
    })
    .onValue()
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
  .onValue(R.ap(callbacks))
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

export const decorateToSubscribeStores = (Component, stores = {}, callbacks = []) => (
  class extends React.Component {
    static displayName = getDisplayName(Component)
    static defaultProps = {}
    state = {}

    /* istanbul ignore next */
    constructor(props) {
      super(props)
      this.subscribeToStores()
      this.isConstructed = true
    }

    componentWillUnmount() {
      this.dispose()
      removeStores(this, stores)
    }

    subscribeToStores() {
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

export const decorateToConsumeContext = (Component) => {
  const decorated = (props) => (
    <BduxContext.Consumer>
      {(bdux) => (
        <Component
          {...props}
          bdux={bdux}
          dispatch={getDispatch(bdux)}
          bindToDispatch={getBindToDispatch(bdux)}
        />
      )}
    </BduxContext.Consumer>
  )

  decorated.displayName = getDisplayName(Component)
  decorated.defaultProps = {}
  return decorated
}


const decorateByMiddlewares = (Component) => (
  R.isEmpty(decorators.get())
    ? Component
    : R.apply(R.pipe, decorators.get())(Component)
)

const createComponentImplement = (Component, stores = {}, ...callbacks) => (
  decorateToConsumeContext(
    decorateToSubscribeStores(
      decorateByMiddlewares(Component),
      stores,
      callbacks
    )
  )
)

const createComponentPipe = (stores = {}, ...callbacks) => (Component) => (
  // convenient to pipe decorators.
  createComponentImplement(Component, stores, ...callbacks)
)

export const createComponent = (...args) => (
  // if the first argument is a react component.
  (React.Component.isPrototypeOf(args[0]) || R.is(Function, args[0]))
    ? createComponentImplement(...args)
    : createComponentPipe(...args)
)
