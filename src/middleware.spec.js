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

  const createDecorator = () => ({
    decorateComponent: R.F
  })

  const createAll = () => R.mergeAll([
    createPreReduce(),
    createPostReduce(),
    createDecorator()
  ])

  it('should apply a single middleware before reducer', () => {
    const pre = createPreReduce()
    clearMiddlewares()
    applyMiddleware(pre)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [pre.getPreReduce],
      postReduces: [],
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
      decorators: []
    })
  })

})
