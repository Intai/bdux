import {
  F,
  forEachObjIndexed,
  identity,
  is,
  isEmpty,
  juxt,
  map,
  mapObjIndexed,
  mergeRight,
  pathOr,
  pipe,
  values,
} from 'ramda'
import { combineTemplate } from 'baconjs'
import React from 'react'
import Common from './utils/common-util'
import BduxContext from './context'
import { decorators } from './middleware'

const getDisplayName = (Component) => (
  Component.displayName || Component.name
    || (Component.type && Component.type.displayName)
    || 'Component'
)

const getDispatch = pathOr(
  F, ['dispatcher', 'dispatchAction']
)

const getBindToDispatch = pathOr(
  identity, ['dispatcher', 'bindToDispatch']
)

const subscribe = (component) => (store, name) => (
  // subscribe to a store.
  store.getProperty(component.props)
    // todo: workaround baconjs v2 bug causing onValue to be not synchronous.
    .doAction(state => {
      // pass its state update to the react component.
      if (!component.isConstructed) {
        component.state[name] = state;
      } else {
        component.setState({
          // under the name specified.
          [name]: state
        })
      }
    })
    .onValue()
)

const getProperties = (component) => map((store) => (
  store.getProperty(component.props)
))

const triggerCallbacks = (component, stores, callbacks) => (
  combineTemplate({
    ...getProperties(component)(stores),
    props: component.props
  })
  .first()
  .onValue(juxt(
    getBindToDispatch(component.props.bdux)(callbacks)
  ))
)

const pipeFuncs = (funcs) => (
  (funcs && funcs.length > 0)
    ? pipe(...funcs)
    : F
)

const removeStores = (component) => forEachObjIndexed((store) => {
  store.removeProperty(component.props)
})

export const decorateToSubscribeStores = (Component, stores = {}, callbacks = []) => (
  class extends React.Component {
    static displayName = getDisplayName(Component)
    static defaultProps = {}
    state = {}

    constructor(props) {
      super(props)
      this.subscribeToStores()
      this.isConstructed = true
    }

    componentWillUnmount() {
      this.dispose()
      removeStores(this)(stores)
    }

    subscribeToStores() {
      // pipe all dispose functions.
      this.dispose = pipeFuncs(
        // get the array of dispose functions.
        values(
          // subscribe to stores.
          mapObjIndexed(
            subscribe(this),
            stores)
        )
      )

      // trigger callbacks after subscribing to stores.
      triggerCallbacks(this, stores, callbacks)
    }

    render() {
      const element = React.createElement(
        Component, mergeRight(this.props, this.state))

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
  isEmpty(decorators.get())
    ? Component
    : pipe(...decorators.get())(Component)
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
  // eslint-disable-next-line no-prototype-builtins
  (React.Component.isPrototypeOf(args[0]) || is(Function, args[0]))
    ? createComponentImplement(...args)
    : createComponentPipe(...args)
)
