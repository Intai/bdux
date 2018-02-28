/* eslint-env mocha */

import R from 'ramda'
import chai from 'chai'
import {
  getMiddlewares,
  clearMiddlewares,
  applyMiddleware } from './middleware'

describe('middleware', () => {

  const createPreReduce = () => ({
    getPreReduce: R.F
  })

  const createPostReduce = () => ({
    getPostReduce: R.F
  })

  const createDefaultValue = () => ({
    getDefaultValue: R.F
  })

  const createDecorator = () => ({
    decorateComponent: R.F
  })

  const createAll = () => R.mergeAll([
    createPreReduce(),
    createPostReduce(),
    createDefaultValue(),
    createDecorator()
  ])

  it('should apply a single middleware before reducer', () => {
    const pre = createPreReduce()
    clearMiddlewares()
    applyMiddleware(pre)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [pre.getPreReduce],
      postReduces: [],
      defaultValues: [],
      decorators: []
    })
  })

  it('should apply a single middleware after reducer', () => {
    const post = createPostReduce()
    clearMiddlewares()
    applyMiddleware(post)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [],
      postReduces: [post.getPostReduce],
      defaultValues: [],
      decorators: []
    })
  })

  it('should apply a single middleware for default value', () => {
    const middleware = createDefaultValue()
    clearMiddlewares()
    applyMiddleware(middleware)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [],
      postReduces: [],
      defaultValues: [middleware.getDefaultValue],
      decorators: []
    })
  })

  it('should apply a single middleware to decorate component', () => {
    const decorator = createDecorator()
    clearMiddlewares()
    applyMiddleware(decorator)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [],
      postReduces: [],
      defaultValues: [],
      decorators: [decorator.decorateComponent]
    })
  })

  it('should apply a single middleware before and after reducer', () => {
    const all = createAll()
    clearMiddlewares()
    applyMiddleware(all)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [all.getPreReduce],
      postReduces: [all.getPostReduce],
      defaultValues: [all.getDefaultValue],
      decorators: [all.decorateComponent]
    })
  })

  it('should apply multiple middlewares', () => {
    const pre = createPreReduce()
    const post = createPostReduce()
    clearMiddlewares()
    applyMiddleware(pre, post)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [pre.getPreReduce],
      postReduces: [post.getPostReduce],
      defaultValues: [],
      decorators: []
    })
  })

  it('should apply accumulate middlewares', () => {
    const pre = createPreReduce()
    const all = createAll()
    clearMiddlewares()
    applyMiddleware(pre, all)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [pre.getPreReduce, all.getPreReduce],
      postReduces: [all.getPostReduce],
      defaultValues: [all.getDefaultValue],
      decorators: [all.decorateComponent]
    })
  })

  it('should clear middlewares', () => {
    const all = createAll()
    applyMiddleware(all)
    clearMiddlewares()
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [],
      postReduces: [],
      defaultValues: [],
      decorators: []
    })
  })

})
