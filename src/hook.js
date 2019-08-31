import {
  assoc,
  F,
  forEach,
  forEachObjIndexed,
  identity,
  map,
  mergeRight,
  pathOr,
  reduce,
} from 'ramda'
import * as Bacon from 'baconjs'
import { useContext, useState, useMemo, useEffect } from 'react'
import Common from './utils/common-util'
import BduxContext from './context'
import { hooks } from './middleware'

const getDispatch = pathOr(
  F, ['dispatcher', 'dispatchAction']
)

const getBindToDispatch = pathOr(
  identity, ['dispatcher', 'bindToDispatch']
)

const skipDuplicates = () => {
  let prev
  return (value) => {
    const shouldSkip = prev !== undefined && prev === value
    prev = value
    return !shouldSkip
  }
}

const skipProperties = map(
  // todo: workaround baconjs v2 bug around skipDuplicates not skipping.
  property => property.filter(skipDuplicates())
)

const getProperties = (bdux, props, stores) => (() => {
  let cached
  return () => {
    if (!cached) {
      const data = { ...props, bdux }
      // cache the store properties.
      cached = map(
        store => store.getProperty(data),
        stores
      )
    }
    return cached
  }
})()

const removeProperties = props => map(
  store => store.removeProperty(props)
)

const useBduxState = (getStoreProperties) => useState(() => {
  let initial = {}
  forEachObjIndexed(
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

const useCustomHooks = (props, params) => (
  reduce(
    (acc, useHook) => {
      // run synchronously at the beginning of use fuction.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      const ret = useHook(props, params)
      return ret ? mergeRight(acc, ret) : acc
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

  const dispose = useMemo(() => (
    // subscribe to store properties.
    Bacon.combineTemplate(skipProperties(getStoreProperties()))
      .skip(1)
      .onValue(setState)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [])

  const unmount = () => {
    dispose()
    removeProperties({ ...props, bdux })(stores)
  }

  useEffect(
    () => {
      // trigger callback actions.
      const data = assoc('props', props, state)
      forEach(callback => dispatch(callback(data)), callbacks)
      // unsubscribe.
      return unmount
    },
    // only on mount and unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  // assuming only render once on server.
  if (Common.isOnServer()) {
    // unmount afterward straight away.
    unmount()
  }

  const params = {
    dispatch,
    bindToDispatch,
    state,
  }
  return {
    ...useCustomHooks(props, params),
    ...params,
  }
}

export const createUseBdux = (stores = {}, ...callbacks) => props => (
  useBdux(props, stores, ...callbacks)
)
