import R from 'ramda'

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

// react component decorators.
export const decorators = createCollection(
  appendMiddleware('decorateComponent')
)

export const applyMiddleware = (...args) => {
  // loop through an array of middlewares.
  R.forEach(R.juxt([
    preReduces.append,
    postReduces.append,
    decorators.append
  ]), args)
}

export const clearMiddlewares = R.juxt([
  preReduces.clear,
  postReduces.clear,
  decorators.clear
])

export const getMiddlewares = () => R.clone({
  preReduces: preReduces.get(),
  postReduces: postReduces.get(),
  decorators: decorators.get()
})
