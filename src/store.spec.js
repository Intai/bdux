/* eslint-env mocha */

import R from 'ramda'
import chai from 'chai'
import sinon from 'sinon'
import Bacon from 'baconjs'
import { getActionStream } from './dispatcher'
import { createStore } from './store'
import {
  clearMiddlewares,
  applyMiddleware } from './middleware'

const createPluggable = (log) => () => {
  const stream = new Bacon.Bus()
  return {
    input: stream,
    output: stream
      .doAction(log)
  }
}

const createPreLogger = (log) => ({
  getPreReduce: createPluggable(log)
})

const createPostLogger = (log) => ({
  getPostReduce: createPluggable(log)
})

const createLogger = (logPre, logPost) => R.merge(
  createPreLogger(logPre),
  createPostLogger(logPost)
)

const createDefaultValue = (value) => ({
  getDefaultValue: R.always(value)
})

describe('Store', () => {

  let sandbox, clock

  beforeEach(() => {
    sandbox = sinon.sandbox.create()
    clock = sinon.useFakeTimers(Date.now())
  })

  it('should create a store property', () => {
    const store = createStore('name', createPluggable())
    chai.expect(store).to.have.property('getProperty')
      .and.is.a('function')
  })

  it('should get the same store property instance', () => {
    const store = createStore('name', createPluggable())
    chai.expect(store.getProperty()).to.equal(store.getProperty())
  })

  it('should get the same store property instance by props', () => {
    const store = createStore(R.prop('id'), createPluggable())
    const property1 = store.getProperty({ id: 1 })
    const property2 = store.getProperty({ id: 1 })
    chai.expect(property1).to.equal(property2)
  })

  it('should get different store property instances by props', () => {
    const store = createStore(R.prop('id'), createPluggable())
    const property1 = store.getProperty({ id: 1 })
    const property2 = store.getProperty({ id: 2 })
    chai.expect(property1).to.not.equal(property2)
  })

  it('should remove a store property instance of props', () => {
    const getInstance = props => ({
      name: props.id,
      isRemovable: true
    })

    const store = createStore(getInstance, createPluggable())
    const property1 = store.getProperty({ id: 1 })
    store.removeProperty({ id: 1 })
    const property2 = store.getProperty({ id: 1 })
    chai.expect(property1).to.not.equal(property2)
  })

  it('should not remove a store property instance of props', () => {
    const getInstance = props => ({
      name: props.id,
      isRemovable: false
    })

    const store = createStore(getInstance, createPluggable())
    const property1 = store.getProperty({ id: 1 })
    store.removeProperty({ id: 1 })
    const property2 = store.getProperty({ id: 1 })
    chai.expect(property1).to.equal(property2)
  })

  it('should create a store property which is a bacon observable', () => {
    const store = createStore('name', createPluggable())
    chai.expect(store.getProperty()).to.be.instanceof(Bacon.Observable)
  })

  it('should create a store property which defaults to null', () => {
    const store = createStore('name', createPluggable())
    const callback = sinon.stub()
    store.getProperty().onValue(callback)
    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.be.null
  })

  it('should create store properties which all default to null', () => {
    const store = createStore(R.prop('id'), createPluggable())
    const property1 = store.getProperty({ id: 1 })
    const property2 = store.getProperty({ id: 2 })
    const callback1 = sinon.stub()
    const callback2 = sinon.stub()
    property1.onValue(callback1)
    getActionStream().push({})
    property2.onValue(callback2)

    chai.expect(callback1.calledTwice).to.be.true
    chai.expect(callback1.firstCall.args[0]).to.be.null
    chai.expect(callback2.calledOnce).to.be.true
    chai.expect(callback2.lastCall.args[0]).to.be.null
  })

  it('should be inactive without subscriber', () => {
    const logReduce = sinon.stub()
    createStore('name', createPluggable(logReduce))
    getActionStream().push({})
    chai.expect(logReduce.called).to.be.false
  })

  it('should be active with subscriber', () => {
    const logReduce = sinon.stub()
    const store = createStore('name', createPluggable(logReduce))
    store.getProperty().onValue()
    getActionStream().push({})
    chai.expect(logReduce.calledOnce).to.be.true
  })

  it('should be inactive or active independently', () => {
    const logReduce = sinon.stub()
    const store = createStore(R.prop('id'), createPluggable(logReduce))
    store.getProperty({ id: 1 })
    store.getProperty({ id: 2 }).onValue()
    getActionStream().push({})
    chai.expect(logReduce.calledOnce).to.be.true
    chai.expect(logReduce.lastCall.args[0]).to.have.property('name', 2)
  })

  it('should receive action to reduce', () => {
    const logReduce = sinon.stub()
    const store = createStore('name', createPluggable(logReduce))
    store.getProperty().onValue()
    getActionStream().push({
      type: 'test'
    })

    chai.expect(logReduce.calledOnce).to.be.true
    chai.expect(logReduce.lastCall.args[0]).to.have.property('action')
      .and.eql({
        type: 'test'
      })
  })

  it('should receive state to reduce', () => {
    const logReduce = sinon.stub()
    const store = createStore('name', createPluggable(logReduce))
    store.getProperty().onValue()
    getActionStream().push({})

    chai.expect(logReduce.calledOnce).to.be.true
    chai.expect(logReduce.lastCall.args[0]).to.have.property('state')
      .and.is.null
  })

  it('should receive another state to reduce', () => {
    const logReduce = sinon.stub()
    const other = createStore('other', createPluggable())
    const store = createStore('name', createPluggable(logReduce), { other: other })
    store.getProperty().onValue()
    getActionStream().push({})

    chai.expect(logReduce.calledOnce).to.be.true
    chai.expect(logReduce.lastCall.args[0]).to.have.property('other')
      .and.is.null
  })

  it('should flow multiple actions to reduce', () => {
    const logReduce = sinon.stub()
    const store = createStore('name', createPluggable(logReduce))
    store.getProperty().onValue()
    getActionStream().plug(Bacon.fromArray(R.repeat({}, 3)))
    clock.tick(1)
    chai.expect(logReduce.calledThrice).to.be.true
  })

  it('should receive the current state to reduce', () => {
    const logReduce = sinon.stub()
    const store = createStore('name', () => {
      const stream = new Bacon.Bus()
      return {
        input: stream,
        output: stream
          .doAction(logReduce)
          .map(R.always('test'))
      }
    })

    store.getProperty().onValue()
    getActionStream().push({})
    getActionStream().push({})
    chai.expect(logReduce.calledTwice).to.be.true
    chai.expect(logReduce.lastCall.args[0]).to.have.property('state')
      .and.equal('test')
  })

  it('should receive the current state of another store to reduce', () => {
    const logReduce = sinon.stub()
    const other = createStore('other', () => {
      const stream = new Bacon.Bus()
      return {
        input: stream,
        output: stream
          .map(R.always('test'))
      }
    })

    const store = createStore('name',
      createPluggable(logReduce), {
        other: other
      }
    )

    store.getProperty().onValue()
    getActionStream().plug(Bacon.fromArray(R.repeat({}, 2)))
    clock.tick(1)
    chai.expect(logReduce.calledTwice).to.be.true
    chai.expect(logReduce.lastCall.args[0]).to.have.property('other')
      .and.to.equal('test')
  })

  it('should hold the next action until the current one is reduced', () => {
    const logReduce = sinon.stub()
    const store = createStore('name', () => {
      const stream = new Bacon.Bus()
      return {
        input: stream,
        output: stream
          .doAction(logReduce)
          .delay(2)
      }
    })

    store.getProperty().onValue()
    getActionStream().plug(Bacon.fromArray(R.repeat({}, 3)))
    clock.tick(1)
    chai.expect(logReduce.calledOnce).to.be.true
    clock.tick(1)
    chai.expect(logReduce.calledTwice).to.be.true
  })

  it('should set store defualt value from middleware', () => {
    clearMiddlewares()
    applyMiddleware(createDefaultValue('middleware'))

    const callback = sinon.stub()
    const store = createStore('name', createPluggable())
    store.getProperty().onValue(callback)
    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.equal('middleware')
  })

  it('should pass store default value to the next middleware', () => {
    const callback = sinon.stub()
    clearMiddlewares()
    applyMiddleware(
      createDefaultValue('previous'),
      { getDefaultValue: callback })

    const store = createStore('name', createPluggable())
    store.getProperty().onValue()
    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.equal('previous')
  })

  it('should reduce against store default value', () => {
    const logPre = sinon.stub()
    clearMiddlewares()
    applyMiddleware(
      createDefaultValue('middleware'),
      createPreLogger(logPre))

    const store = createStore('name', createPluggable())
    store.getProperty().onValue()
    getActionStream().push({})
    chai.expect(logPre.calledOnce).to.be.true
    chai.expect(logPre.lastCall.args[0]).to.eql({
      name: 'name',
      action: {},
      state: 'middleware'
    })
  })

  it('should pass store name to middleware pluggable before reducer', () => {
    const logger = createLogger()
    sandbox.spy(logger, 'getPreReduce')
    clearMiddlewares()
    applyMiddleware(logger)

    const store = createStore('name', createPluggable())
    store.getProperty().onValue()
    getActionStream().push({})
    chai.expect(logger.getPreReduce.calledOnce).to.be.true
    chai.expect(logger.getPreReduce.lastCall.args[0]).to.equal('name')
  })

  it('should pass store name to middleware pluggable after reducer', () => {
    const logger = createLogger()
    sandbox.spy(logger, 'getPostReduce')
    clearMiddlewares()
    applyMiddleware(logger)

    const store = createStore('name', createPluggable())
    store.getProperty().onValue()
    getActionStream().push({})
    chai.expect(logger.getPostReduce.calledOnce).to.be.true
    chai.expect(logger.getPostReduce.lastCall.args[0]).to.equal('name')
  })

  it('should flow through a single middleware before reducer', () => {
    const logPre = sinon.stub()
    const logger = createPreLogger(logPre)
    clearMiddlewares()
    applyMiddleware(logger)

    const store = createStore('name', () => {
      const stream = new Bacon.Bus()
      return {
        input: stream,
        output: stream
          .delay(1)
      }
    })

    store.getProperty().onValue()
    getActionStream().push({})
    chai.expect(logPre.calledOnce).to.be.true
    chai.expect(logPre.lastCall.args[0]).to.eql({
      name: 'name',
      action: {},
      state: null
    })
  })

  it('should flow through a single middleware after reducer', () => {
    const logPost = sinon.stub()
    const logger = createPostLogger(logPost)
    clearMiddlewares()
    applyMiddleware(logger)

    const store = createStore('name', () => {
      const stream = new Bacon.Bus()
      return {
        input: stream,
        output: stream
          .map(R.always('test'))
          .delay(1)
      }
    })

    store.getProperty().onValue()
    getActionStream().push({})
    chai.expect(logPost.called).to.be.false

    clock.tick(1)
    chai.expect(logPost.calledOnce).to.be.true
    chai.expect(logPost.lastCall.args[0]).to.eql({
      name: 'name',
      action: {},
      state: null,
      nextState: 'test'
    })
  })

  it('should flow through multiple middlewares', () => {
    const logPre = sinon.stub()
    const logPost = sinon.stub()
    clearMiddlewares()
    applyMiddleware(
      createPreLogger(logPre),
      createLogger(logPre, logPost))

    const store = createStore('name', () => {
      const stream = new Bacon.Bus()
      return {
        input: stream,
        output: stream
          .map(R.always('test'))
          .delay(1)
      }
    })

    store.getProperty().onValue()
    getActionStream().push({})
    chai.expect(logPre.calledTwice).to.be.true
    chai.expect(logPre.lastCall.args[0]).to.eql({
      name: 'name',
      action: {},
      state: null
    })

    clock.tick(1)
    chai.expect(logPost.calledOnce).to.be.true
    chai.expect(logPost.lastCall.args[0]).to.eql({
      name: 'name',
      action: {},
      state: null,
      nextState: 'test'
    })
  })

  afterEach(() => {
    clock.restore()
    sandbox.restore()
  })

})
