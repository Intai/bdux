/* eslint-env mocha */

import chai from 'chai'
import sinon from 'sinon'
import Bacon from 'baconjs'
import {
  bindToDispatch,
  getActionStream } from './dispatcher'

describe('Dispatcher', () => {

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

    chai.expect(callback.calledTwice).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'pass'
    })
  })

})
