import {
  assoc,
  F,
  forEach,
  forEachObjIndexed,
  keys,
  identity,
  inc,
  map,
  mergeRight,
  pathOr,
  reduce,
} from 'ramda'
import * as Bacon from 'baconjs'
import { useContext, useState, useRef, useMemo, useEffect } from 'react'
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

const getInitialState = (storeProperties) => {
  let initial = {}
  // forEach instead of combineTemplate to be synchronous.
  forEachObjIndexed(
    (property, name) => {
      property
        // todo: workaround baconjs v2 bug causing onValue to be not synchronous.
        .doAction(val => initial[name] = val)
        .onValue(() => Bacon.noMore)
    },
    storeProperties
  )
  return initial
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initialState = useMemo(() => getInitialState(storeProperties), [])
  const [, setForceUpdate] = useState(0)
  const stateRef = useRef(initialState)
  const disposeRef = useRef()

  disposeRef.current = useMemo(() => {
    const { current: dispose } = disposeRef
    if (dispose) {
      // unsubscribe from the previous store properties.
      dispose()
    }
    // dont trigger redundant forceUpdate when we are already rendering.
    let isFirstRender = true
    // subscribe to store properties.
    return Bacon.combineTemplate(skipProperties(storeProperties))
      .onValue((val) => {
        stateRef.current = val
        if (!isFirstRender) {
          setForceUpdate(inc)
        }
        isFirstRender = false
      })
  }, [skipProperties, storeProperties])

  const unmount = () => {
    disposeRef.current()
    removeProperties({ ...props, bdux })(stores)
  }

  useEffect(
    () => {
      // trigger callback actions.
      const data = assoc('props', props, stateRef.current)
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
    state: stateRef.current,
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
