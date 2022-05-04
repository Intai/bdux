import {
  assoc,
  F,
  forEach,
  forEachObjIndexed,
  keys,
  identity,
  map,
  mergeRight,
  pathOr,
  reduce,
} from 'ramda'
import { combineTemplate, noMore } from 'baconjs'
import { useContext, useCallback, useMemo, useEffect, useSyncExternalStore } from 'react'
import Common from './utils/common-util'
import BduxContext from './context'
import { hooks } from './middleware'

const getDispatch = pathOr(
  F, ['dispatcher', 'dispatchAction']
)

const getBindToDispatch = pathOr(
  identity, ['dispatcher', 'bindToDispatch']
)

const skipPropertiesDefault = map(
  property => property.skipDuplicates()
)

const shallowEqual = (a, b) => {
  const keysA = keys(a)
  const keysB = keys(b)

  if (keysA.length !== keysB.length) {
    return false
  }
  for (let i = 0; i < keysA.length; i++) {
    const key = keysA[i]
    const valueA = a[key]
    const valueB = b[key]

    if (valueA !== valueB) {
      return false
    }
  }
  return true
}

const getPropertiesMemo = () => {
  let cached
  let prevBdux
  let prevProps
  let prevStores

  return (bdux, props, stores) => {
    if (!cached || prevBdux !== bdux
      || !shallowEqual(prevProps, props)
      || !shallowEqual(prevStores, stores)) {
      // cache the store properties.
      cached = map(
        store => store.getProperty({ ...props, bdux }),
        stores
      )
      prevBdux = bdux
      prevProps = props
      prevStores = stores
    }
    return cached
  }
}

const removeProperties = props => map(
  store => store.removeProperty(props)
)

const getSnapshotsMemo = (storeProperties) => {
  let cached = {}

  return () => {
    let initial = {}

    // forEach instead of combineTemplate to be synchronous.
    forEachObjIndexed(
      (property, name) => {
        property
          // todo: workaround baconjs v2 bug causing onValue to be not synchronous.
          .doAction(val => initial[name] = val)
          .onValue(() => noMore)
      },
      storeProperties
    )

    if (!shallowEqual(cached, initial)) {
      // cache the store snapshots.
      cached = initial
    }
    return cached
  }
}

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

export const useBdux = (
  props,
  stores = {},
  callbacks = [],
  skipProperties = skipPropertiesDefault,
) => {
  const bdux = useContext(BduxContext)
  const dispatch = getDispatch(bdux)
  const bindToDispatch = getBindToDispatch(bdux)
  const getProperties = useMemo(() => getPropertiesMemo(), [])
  const storeProperties = getProperties(bdux, props, stores)
  const getSnapshots = useMemo(() => getSnapshotsMemo(storeProperties), [storeProperties])

  const state = useSyncExternalStore(
    useCallback((callback) => (
      Common.isOnServer()
        // assuming only render once on server.
        ? undefined
        // subscribe to stores in browser.
        : combineTemplate(skipProperties(storeProperties))
          .onValue(callback)
    ), [skipProperties, storeProperties]),

    // combine store snapshots.
    getSnapshots,
    getSnapshots
  )

  const unmount = () => {
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

export const createUseBdux = (
  stores = {},
  callbacks = [],
  skipDuplicates = skipPropertiesDefault,
) => props => (
  useBdux(props, stores, callbacks, skipDuplicates)
)
