import * as R from 'ramda';

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
  Date.now || (() => new Date().getTime())
)

export default {

  now: getTimeFunc(),

  isOnServer: R.once(
    R.complement(
      R.anyPass([
        canUseDOM,
        isReactNative
      ])
    )
  )
}
