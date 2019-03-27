import * as R from 'ramda'
import Bacon from 'baconjs'
import { useContext, useState, useEffect } from 'react'
import BduxContext from './context'
import { hooks } from './middleware'

const getDispatch = R.pathOr(
  R.F, ['dispatcher', 'dispatchAction']
)

const getBindToDispatch = R.pathOr(
  R.identity, ['dispatcher', 'bindToDispatch']
)

const getProperties = (bdux, props, stores) => (() => {
  let cached
  return () => {
    if (!cached) {
      const data = { ...props, bdux }
      // cache the store properties.
      cached = R.map(
        store => store.getProperty(data),
        stores
      )
    }
    return cached
  }
})()

const removeProperties = props => R.map(
  store => store.removeProperty(props)
)

const useBduxState = (getStoreProperties) => useState(() => {
  let initial = {}
  R.forEachObjIndexed(
    (property, name) => {
      property
        // todo: workaround baconjs v2 bug causing onValue to be not synchronous.
        .doAction(val => initial[name] = val)
        .onValue(() => Bacon.noMore)
    },
    // forEach instead of combineTemplate to be synchronous.
    getStoreProperties()
  )
  return initial
})

const useCustomHooks = props => (
  R.reduce(
    (acc, useHook) => {
      // run synchronously at the beginning of use fuction.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const ret = useHook(props)
      return ret ? R.mergeRight(acc, ret) : acc
    },
    {},
    hooks.get()
  )
)

export const useBdux = (props, stores = {}, ...callbacks) => {
  const bdux = useContext(BduxContext)
  const dispatch = getDispatch(bdux)
  const bindToDispatch = getBindToDispatch(bdux)
  const getStoreProperties = getProperties(bdux, props, stores)
  const [state, setState] = useBduxState(getStoreProperties)

  useEffect(
    () => {
      // subscribe to store properties.
      const dispose = Bacon.combineTemplate(getStoreProperties())
        .skip(1)
        .onValue(setState)
      // trigger callback actions.
      const data = R.assoc('props', props, state)
      R.forEach(callback => dispatch(callback(data)), callbacks)
      // unsubscribe.
      return () => {
        dispose()
        removeProperties(props)(stores)
      }
    },
    // only on mount and unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return {
    ...useCustomHooks(props),
    dispatch,
    bindToDispatch,
    state,
  }
}

export const createUseBdux = (stores = {}, ...callbacks) => props => (
  useBdux(props, stores, ...callbacks)
)
