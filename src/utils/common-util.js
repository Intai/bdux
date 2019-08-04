import {
  both,
  complement,
  once,
} from 'ramda';

export const canUseDOM = () => (
  typeof window !== 'undefined'
    && window.document
    && window.document.createElement
)

export const isReactNative = () => (
  typeof window !== 'undefined'
    && window.navigator
    && window.navigator.product === 'ReactNative'
)

export const getTimeFunc = () => (
  (Date.now)
    ? () => Date.now()
    : () => new Date().getTime()
)

export default {

  now: getTimeFunc(),

  isOnServer: once(
    complement(
      both(
        canUseDOM,
        isReactNative
      )
    )
  )
}
