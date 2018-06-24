import React from 'react'
import * as Dispatcher from './dispatcher'

export const defaultContextValue = {
  dispatcher: Dispatcher,
  stores: new WeakMap()
}

export default React.createContext(defaultContextValue)
