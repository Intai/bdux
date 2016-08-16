import R from 'ramda'
import chai from 'chai'
import sinon from 'sinon'
import Bacon from 'baconjs'
import {
  getMiddlewares,
  clearMiddlewares,
  applyMiddleware,
  createStore } from './store'

const logPreReduce = sinon.stub()
const logPostReduce = sinon.stub()

const createPluggable = (log) => () => {
  const stream = new Bacon.Bus()
  return {
    input: stream,
    output: stream
      .doAction(log)
  }
}

const PreLogger = {
  getPreReduce: createPluggable(logPreReduce)
}

const PostLogger = {
  getPostReduce: createPluggable(logPostReduce)
}

const Logger = R.merge(
  PreLogger,
  PostLogger
)

describe('Store', () => {

  it('should apply a single middleware before reducer', () => {
    clearMiddlewares()
    applyMiddleware(PreLogger)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [PreLogger.getPreReduce],
      postReduces: []
    })
  })

  it('should apply a single middleware after reducer', () => {
    clearMiddlewares()
    applyMiddleware(PostLogger)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [],
      postReduces: [PostLogger.getPostReduce]
    })
  })

  it('should apply a single middleware before and after reducer', () => {
    clearMiddlewares()
    applyMiddleware(Logger)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [PreLogger.getPreReduce],
      postReduces: [PostLogger.getPostReduce]
    })
  })

  it('should apply multiple middlewares', () => {
    clearMiddlewares()
    applyMiddleware(PreLogger, PostLogger)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [PreLogger.getPreReduce],
      postReduces: [PostLogger.getPostReduce]
    })
  })

  it('should apply accumulate middlewares', () => {
    clearMiddlewares()
    applyMiddleware(PreLogger, Logger)
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [PreLogger.getPreReduce, PreLogger.getPreReduce],
      postReduces: [PostLogger.getPostReduce]
    })
  })

  it('should clear middlewares', () => {
    applyMiddleware(Logger)
    clearMiddlewares()
    chai.expect(getMiddlewares()).to.eql({
      preReduces: [],
      postReduces: []
    })
  })

})
