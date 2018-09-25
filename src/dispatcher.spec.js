/* eslint-env mocha */

import chai from 'chai'
import sinon from 'sinon'
import Bacon from 'baconjs'
import {
  createDispatcher,
  bindToDispatch,
  getActionStream,
  generateActionId } from './dispatcher'

describe('Dispatcher', () => {

  let clock

  beforeEach(() => {
    clock = sinon.useFakeTimers(Date.now())
  })

  it('should create dispatchers', () => {
    const dispatcher1 = createDispatcher()
    const dispatcher2 = createDispatcher()
    const stream1 = dispatcher1.getActionStream()
    const stream2 = dispatcher2.getActionStream()

    chai.expect(stream1 === stream2).to.be.false
  })

  it('should create independent dispatchers', () => {
    clock.restore()
    clock = sinon.useFakeTimers(1)

    const dispatcher1 = createDispatcher()
    const dispatcher2 = createDispatcher()
    const id1 = dispatcher1.generateActionId()
    const id2 = dispatcher2.generateActionId()

    chai.expect(id1 === id2).to.be.true
  })

  it('should generate action id', () => {
    chai.expect(generateActionId()).to.be.a('number')
  })

  it('should return an action stream', () => {
    const stream = getActionStream()
    chai.expect(stream).to.be.instanceof(Bacon.Observable)
  })

  it('should include action id', () => {
    const callback = sinon.stub()
    getActionStream().onValue(callback)
    bindToDispatch(() => ({}))()

    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.have.property('id')
      .that.is.a('number')
  })

  it('should action always be an object', () => {
    const callback = sinon.stub()
    getActionStream().onValue(callback)
    bindToDispatch(() => 'test')()

    chai.expect(callback.called).to.be.false
  })

  it('should handle falsy action', () => {
    const callback = sinon.stub()
    getActionStream().onValue(callback)
    bindToDispatch(() => null)()

    chai.expect(callback.called).to.be.false
  })

  it('should bind a single action creator', () => {
    const callback = sinon.stub()
    getActionStream().onValue(callback)
    bindToDispatch(() => ({ type: 'test' }))()

    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'test'
    })
  })

  it('should bind multiple action creators', () => {
    const callback = sinon.stub()
    const actions = bindToDispatch({
      test: () => ({ type: 'test' }),
      pass: () => ({ type: 'pass' })
    })

    getActionStream().onValue(callback)
    actions.test()

    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'test'
    })

    actions.pass()
    chai.expect(callback.calledTwice).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'pass'
    })
  })

  it('should bind a single action creator which returns observable', () => {
    const callback = sinon.stub()
    getActionStream().onValue(callback)
    bindToDispatch(() => Bacon.once({ type: 'test' }))()

    clock.tick(1)
    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'test'
    })
  })

  it('should bind a single action creator to produce two actions from observable', () => {
    const callback = sinon.stub()
    getActionStream().onValue(callback)
    bindToDispatch(() => Bacon.fromArray([
      { type: 'test' },
      { type: 'pass' } ]))()

    clock.tick(1)
    chai.expect(callback.calledTwice).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'pass'
    })
  })

  it('should bind multiple action creators which return observables', () => {
    const callback = sinon.stub()
    const actions = bindToDispatch({
      test: () => Bacon.once({ type: 'test' }),
      pass: () => Bacon.once({ type: 'pass' })
    })

    getActionStream().onValue(callback)
    actions.pass()

    clock.tick(1)
    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'pass'
    })
  })

  it('should merge two actions into an observable', () => {
    const callback = sinon.stub()
    const actions = bindToDispatch({
      test: () => Bacon.mergeAll(
        Bacon.once({ type: 'test' }),
        Bacon.once({ type: 'pass' })
      )
    })

    getActionStream().onValue(callback)
    actions.test()

    clock.tick(1)
    chai.expect(callback.calledTwice).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'pass'
    })
  })

  it('should dispatch an action of bacon property', () => {
    const callback = sinon.stub()
    const dispatcher = createDispatcher()
    dispatcher.getActionStream().onValue(callback)
    dispatcher.dispatchAction(Bacon.constant({ type: 'test' }))

    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'test'
    })
  })

  it('should send the latest value of bacon property on subscription', () => {
    const callback = sinon.stub()
    const dispatcher = createDispatcher()
    const bus = new Bacon.Bus()
    dispatcher.getActionStream().onValue(callback)
    dispatcher.dispatchAction(bus.toProperty())
    bus.push({ type: 'test1' })
    bus.push({ type: 'test2' })
    dispatcher.subscribe()

    chai.expect(callback.callCount).to.equal(3)
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'test2'
    })
  })

  afterEach(() => {
    clock.restore()
  })

})
