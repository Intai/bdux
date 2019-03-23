import * as R from 'ramda'

const hasMiddlewareType = (type, middleware) => (
  middleware && R.is(Function, middleware[type])
)

const appendMiddlewareByType = R.converge(
  R.append, [
    R.prop,
    R.nthArg(2)
  ]
)

const appendMiddleware = R.curryN(3,
  R.ifElse(
    hasMiddlewareType,
    appendMiddlewareByType,
    R.nthArg(2)
  )
)

const createCollection = (append) => {
  let array = []

  return {
    get: () => array,
    append: (middleware) => array = append(middleware, array),
    clear: () => array = []
  }
}

// pluggables before store reducer.
export const preReduces = createCollection(
  appendMiddleware('getPreReduce')
)

// pluggables after store reducer.
export const postReduces = createCollection(
  appendMiddleware('getPostReduce')
)

// store default values.
export const defaultValues = createCollection(
  appendMiddleware('getDefaultValue')
)

// react component decorators.
export const decorators = createCollection(
  appendMiddleware('decorateComponent')
)

// react hooks.
export const hooks = createCollection(
  appendMiddleware('useHook')
)

export const applyMiddleware = (...args) => {
  // loop through an array of middlewares.
  R.forEach(R.juxt([
    preReduces.append,
    postReduces.append,
    defaultValues.append,
    decorators.append,
    hooks.append,
  ]), args)
}

export const clearMiddlewares = R.juxt([
  preReduces.clear,
  postReduces.clear,
  defaultValues.clear,
  decorators.clear,
  hooks.clear,
])

export const getMiddlewares = () => R.clone({
  preReduces: preReduces.get(),
  postReduces: postReduces.get(),
  defaultValues: defaultValues.get(),
  decorators: decorators.get(),
  hooks: hooks.get(),
})
