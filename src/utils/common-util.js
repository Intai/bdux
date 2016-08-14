import R from 'ramda';

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

export default {

  isOnServer: R.once(
    R.complement(
      R.anyPass([
        canUseDOM,
        isReactNative
      ])
    )
  )
}
