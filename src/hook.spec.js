/* eslint-env mocha */

import * as R from 'ramda'
import chai from 'chai'
import sinon from 'sinon'
import * as Bacon from 'baconjs'
import React, { useRef } from 'react'
import { JSDOM } from 'jsdom'
import { act, render } from '@testing-library/react'
import BduxContext from './context'
import Common from './utils/common-util'
import { useBdux, createUseBdux } from './hook'
import { createStore } from './store'
import { createDispatcher, getActionStream, dispatchAction } from './dispatcher'
import { clearMiddlewares, applyMiddleware } from './middleware'

const createPluggable = (log = R.F) => () => {
  const stream = new Bacon.Bus()
  return {
    input: stream,
    output: stream
      .doAction(log)
      .map(R.prop('action'))
  }
}

describe('Hook', () => {

  let sandbox

  beforeEach(() => {
    const dom = new JSDOM('<html></html>')
    global.window = dom.window
    global.document = dom.window.document
    global.Element = dom.window.Element

    sandbox = sinon.createSandbox()
    sandbox.stub(Common, 'isOnServer')
      .returns(false)
  })

  afterEach(() => {
    sandbox.restore()
  })

  it('should return dispatch functions', () => {
    const Test = (props) => {
      const bdux = useBdux(props)
      chai.expect(bdux).to.have.property('dispatch')
        .and.is.a('function')
      chai.expect(bdux).to.have.property('bindToDispatch')
        .and.is.a('function')
    }

    render(<Test id="1" />)
  })

  it('should return default state', () => {
    const Test = (props) => {
      const bdux = useBdux(props)
      chai.expect(bdux).to.have.property('state')
        .and.eql({})
    }

    render(<Test id="1" />)
  })

  it('should return initial state', () => {
    const store = createStore('name', createPluggable())
    const Test = (props) => {
      const bdux = useBdux(props, { test: store })
      chai.expect(bdux).to.have.property('state')
        .and.eql({
          test: null
        })
    }

    render(<Test />)
  })

  it('should return current state', () => {
    const store = createStore('name', createPluggable())
    const dispose = store.getProperty().onValue()
    getActionStream().push({ type: 'test1' })
    dispose()

    const Test = (props) => {
      const bdux = useBdux(props, { test: store })
      chai.expect(bdux).to.have.property('state')
        .and.eql({
          test: { type: 'test1' }
        })
    }

    render(<Test />)
  })

  it('should return current state from multiple stores', () => {
    const store = createStore('name2', createPluggable())
    const dispose = store.getProperty().onValue()
    getActionStream().push({ type: 'test2' })
    dispose()

    const Test = (props) => {
      const bdux = useBdux(props, {
        test1: createStore('name1', createPluggable()),
        test2: store
      })
      chai.expect(bdux).to.have.property('state')
        .and.eql({
          test1: null,
          test2: { type: 'test2' }
        })
    }

    render(<Test />)
  })

  it('should use custom hook from middleware', () => {
    const callback = sinon.stub()
    clearMiddlewares()
    applyMiddleware(({
      useHook: (props, { dispatch }) => {
        if (dispatch) {
          callback()
        }
        return {
          logged: props
        }
      }
    }))

    const Test = (props) => {
      const bdux = useBdux(props)
      chai.expect(callback.callCount).to.equal(1)
      chai.expect(bdux).to.have.property('logged')
        .and.eql({ id: '1' })
    }

    render(<Test id="1" />)
  })

  it('should use custom hook from middleware without return', () => {
    const callback = sinon.stub()
    clearMiddlewares()
    applyMiddleware({
      useHook: (props) => {
        callback(props)
      }
    })

    const Test = (props) => {
      useBdux(props)
      chai.expect(callback.callCount).to.equal(1)
      chai.expect(callback.firstCall.args[0]).to.eql({ id: '2' })
    }

    render(<Test id="2" />)
  })

  it('should render a store property', () => {
    const callback = sinon.stub()
    const store = createStore('name', createPluggable())
    const Test = (props) => {
      const bdux = useBdux(props, { test: store })
      callback(bdux)
      return null
    }

    store.getProperty()
      .map(<Test />)
      .map(render)
      .map(R.path(['container', 'innerHTML']))
      .first()
      .onValue()

    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0]).to.have.property('state')
      .and.eql({
        test: null
      })
  })

  it('should receive state update', () => {
    const callback = sinon.stub()
    const store = createStore('name', createPluggable())
    const Test = (props) => {
      const bdux = useBdux(props, { test: store })
      callback(bdux)
      return null
    }

    render(<Test id="a" />)
    act(() => {
      getActionStream().push({ type: 'test2' })
    })
    chai.expect(callback.callCount).to.equal(2)
    chai.expect(callback.lastCall.args[0]).to.have.property('state')
      .and.eql({
        test: { type: 'test2' }
      })
  })

  it('should not re-render without state change', () => {
    const callback = sinon.stub()
    const action = { type: 'test3' }
    const store = createStore('name', createPluggable())
    const dispose = store.getProperty().onValue()
    getActionStream().push(action)
    const Test = (props) => {
      const bdux = useBdux(props, { test: store })
      callback(bdux)
      return null
    }

    render(<Test id="b"/>)
    act(() => {
      getActionStream().push(action)
      getActionStream().push(action)
    })
    chai.expect(callback.callCount).to.equal(1)
    dispose()
  })

  it('should re-render multiple react elements from state change', () => {
    const callback = sinon.stub()
    const action = { type: 'test1' }
    const store = createStore('name', createPluggable())
    const Test = (props) => {
      const bdux = useBdux(props, { test: store })
      callback(bdux)
      return null
    }

    render(<Test />)
    render(<Test />)
    act(() => {
      getActionStream().push(action)
      getActionStream().push(action)
      getActionStream().push(action)
    })
    chai.expect(callback.callCount).to.equal(4)
  })

  it('should not subscribe to stores repeatedly', () => {
    const store = createStore('name', createPluggable())
    const spy = sinon.spy(store, 'getProperty')
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    const { rerender } = render(<Test />)
    rerender(<Test />)
    chai.expect(spy.callCount).to.equal(1)
  })

  it('should subscribe to a store on mount', () => {
    const logReduce = sinon.stub()
    const store = createStore('name', createPluggable(logReduce))
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    render(<Test />)
    act(() => {
      getActionStream().push({})
    })
    chai.expect(logReduce.callCount).to.equal(1)
  })

  it('should subscribe to multiple stores on mount', () => {
    const logReduce = sinon.stub()
    const Test = (props) => {
      useBdux(props, {
        test1: createStore('name1', createPluggable(logReduce)),
        test2: createStore('name2', createPluggable(logReduce))
      })
      return null
    }

    render(<Test />)
    act(() => {
      getActionStream().push({})
    })
    chai.expect(logReduce.callCount).to.equal(2)
  })

  it('should subscribe to multiple stores on update', () => {
    const callback = sinon.stub()
    const store = createStore('name', createPluggable())
    const Test = (props) => {
      const countRef = useRef(1)
      const { state } = useBdux(props, countRef.current <= 1
        ? { test1: store } : { test1: store, test2: store })
      countRef.current += 1
      callback(state)
      return null
    }

    const { rerender } = render(<Test />)
    rerender(<Test />)
    chai.expect(callback.callCount).to.equal(2)
    chai.expect(callback.firstCall.args[0]).to.eql({ test1: null })
    chai.expect(callback.secondCall.args[0]).to.eql({ test1: null, test2: null })
  })

  it('should subscribe to a different store instance by props', () => {
    const logReduce = sinon.stub()
    const store = createStore(R.prop('id'), createPluggable(logReduce))
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    const { rerender } = render(<Test id="1" />)
    rerender(<Test id="2" />)
    act(() => {
      getActionStream().push({})
    })
    chai.expect(logReduce.callCount).to.equal(1)
    chai.expect(logReduce.firstCall.args[0].name).to.equal('2')
  })

  it('should subscribe to the same store instance by props', () => {
    const getReducer = sinon.spy(createPluggable())
    const store = createStore(R.prop('id'), getReducer)
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    const { rerender } = render(<Test id="1" />)
    rerender(<Test id="1" />)
    act(() => {
      getActionStream().push({})
    })
    chai.expect(getReducer.callCount).to.equal(1)
  })

  it('should unsubscribe from a store on unmount', () => {
    const logReduce = sinon.stub()
    const store = createStore('name', createPluggable(logReduce))
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    render(<Test />).unmount()
    act(() => {
      getActionStream().push({})
    })
    chai.expect(logReduce.called).to.be.false
  })

  it('should unsubscribe multiple stores on unmount', () => {
    const logReduce = sinon.stub()
    const Test = (props) => {
      useBdux(props, {
        test1: createStore('name1', createPluggable(logReduce)),
        test2: createStore('name2', createPluggable(logReduce))
      })
      return null
    }

    render(<Test />).unmount()
    act(() => {
      getActionStream().push({})
    })
    chai.expect(logReduce.called).to.be.false
  })

  it('should unsubscribe from a store on server', () => {
    Common.isOnServer.returns(true)

    const logReduce = sinon.stub()
    const store = createStore('name', createPluggable(logReduce))
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    render(<Test />)
    act(() => {
      getActionStream().push({})
    })
    chai.expect(logReduce.called).to.be.false
  })

  it('should unsubscribe from a store by props', () => {
    const logReduce = sinon.stub()
    const store = createStore(R.prop('id'), createPluggable(logReduce))
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    render(<Test id="1" />).unmount()
    render(<Test id="2" />).unmount()
    act(() => {
      getActionStream().push({})
    })
    chai.expect(logReduce.called).to.be.false
  })

  it('should remove store by props on unmount', () => {
    const getInstance = props => ({
      name: props.id,
      isRemovable: true
    })

    const store = createStore(getInstance, createPluggable())
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    const props = { id: '1' }
    const { unmount } = render(<Test {...props} />)
    const property1 = store.getProperty(props)
    unmount()
    const property2 = store.getProperty(props)
    chai.expect(property1 === property2).to.be.false
  })

  it('should not remove store by props on unmount', () => {
    const getInstance = props => ({
      name: props.id,
      isRemovable: false
    })

    const store = createStore(getInstance, createPluggable())
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    const props = { id: '2' }
    const property1 = store.getProperty(props)
    render(<Test {...props} />).unmount()
    const property2 = store.getProperty(props)
    chai.expect(property1 === property2).to.be.true
  })

  it('should trigger a single callback after subscription', () => {
    const callback = sinon.stub()
    const store = createStore('name', createPluggable())
    const Test = (props) => {
      useBdux(props, { test: store }, [callback])
      return null
    }

    render(<Test id="3" />)
    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0])
      .to.include({ test: null })
      .and.have.property('props')
      .which.eql({ id: '3' })
  })

  it('should trigger a callback from rendering a store property', () => {
    const callback = sinon.stub()
    const store = createStore('name', createPluggable())
    const Test = (props) => {
      useBdux(props, { test: store }, [callback])
      return null
    }

    store.getProperty()
      .map(<Test />)
      .map(render)
      .first()
      .onValue()

    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0])
      .to.include({ test: null })
      .and.have.property('props')
  })

  it('should trigger multiple callbacks after subscription', () => {
    const callback1 = sinon.stub()
    const callback2 = sinon.stub()
    const Test = (props) => {
      useBdux(props,
        {
          test1: createStore('name1', createPluggable()),
          test2: createStore('name2', createPluggable())
        }, [
          callback1,
          callback2,
        ]
      )

      return null
    }

    render(<Test />)
    chai.expect(callback1.callCount).to.equal(1)
    chai.expect(callback2.callCount).to.equal(1)
    chai.expect(callback2.lastCall.args[0])
      .to.include({ test1: null, test2: null })
      .and.have.property('props')
      .which.eql({})
  })

  it('should bind callbacks to dispatch', () => {
    const callback = sinon.stub()
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }
    const Test = (props) => {
      useBdux(props, {}, [R.always({ type: 'test' })])
      return null
    }
    const dispose = bdux.dispatcher
      .getActionStream()
      .onValue(callback)

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0])
      .to.include({ type: 'test' })
      .and.have.property('id')
    dispose()
  })

  it('should skip duplicates if stores stay the same', () => {
    const callback = sinon.stub()
    const store = createStore('name', () => {
      const stream = new Bacon.Bus()
      return {
        input: stream,
        output: stream.map(R.prop('state'))
      }
    })
    const Test = (props) => {
      const { state } = useBdux(props, {
        test1: store,
        test2: store,
      })
      callback(state)
      return null
    }

    render(<Test />)
    act(() => {
      dispatchAction({})
    })
    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0]).to.eql({
      test1: null,
      test2: null,
    })
  })

  it('should not skip duplicates if stores have changed', () => {
    const callback = sinon.stub()
    const store = createStore('name', () => {
      const stream = new Bacon.Bus()
      return {
        input: stream,
        output: stream.map(({ state }) => (state || 0) + 1)
      }
    })
    const Test = (props) => {
      const { state } = useBdux(props, {
        test1: store,
        test2: store,
      })
      callback(state)
      return null
    }

    render(<Test />)
    act(() => {
      dispatchAction({})
    })
    chai.expect(callback.callCount).to.equal(2)
    chai.expect(callback.lastCall.args[0]).to.eql({
      test1: 1,
      test2: 1,
    })
  })

  it('should customise skip duplicates', () => {
    const callback = sinon.stub()
    const store = createStore('name1', () => {
      const stream = new Bacon.Bus()
      return {
        input: stream,
        output: stream.map(({ state }) => (state || 0) + 1)
      }
    })
    const skipDuplicates = R.map(
      property => property.skipDuplicates(R.T)
    )
    const Test = (props) => {
      const { state } = useBdux(props, { test: store }, [], skipDuplicates)
      callback(state)
      return null
    }

    render(<Test />)
    act(() => {
      dispatchAction({})
    })
    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0]).to.have.property('test', null)
  })

  it('should create bdux hook', () => {
    const callback1 = sinon.stub()
    const callback2 = sinon.stub()
    const useBdux = createUseBdux(
      { test: createStore('name', createPluggable()) },
      [callback1, callback2]
    )
    const Test = (props) => {
      useBdux(props)
      return null
    }

    render(<Test className="hidden" />)
    chai.expect(callback1.callCount).to.equal(1)
    chai.expect(callback2.callCount).to.equal(1)
    chai.expect(callback2.lastCall.args[0])
      .to.include({ test: null })
      .and.have.property('props')
      .which.include({ className: 'hidden' })
  })

  it('should create bdux hook without store', () => {
    const callback = sinon.stub()
    const useBdux = createUseBdux()
    const Test = (props) => {
      const bdux = useBdux(props)
      callback(bdux)
      return null
    }

    render(<Test />)
    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0]).to.have.property('state')
      .and.eql({})
  })

  it('should keep stores in context', () => {
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }
    const store = createStore('name', createPluggable())
    const getProperty = sinon.spy(store, 'getProperty')
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(getProperty.callCount).to.equal(1)
    chai.expect(getProperty.firstCall.args[0]).to.have.property('bdux', bdux)
    chai.expect(bdux.stores.has(store)).to.be.true
  })

  it('should remove store by props in context', () => {
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }
    const getInstance = props => ({
      name: props.id,
      isRemovable: true
    })

    const store = createStore(getInstance, createPluggable())
    const Test = (props) => {
      useBdux(props, { test: store })
      return null
    }

    const { unmount } = render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test id="1" />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(bdux.stores.get(store)).to.have.property('1')
    unmount()
    chai.expect(bdux.stores.get(store)).to.not.have.property('1')
  })

  it('should receive value from context provider', () => {
    const callback = sinon.stub()
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }
    const Test = (props) => {
      const bdux = useBdux(props)
      callback(bdux)
      return null
    }

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0]).to.include({
      dispatch: bdux.dispatcher.dispatchAction,
      bindToDispatch: bdux.dispatcher.bindToDispatch
    })
  })

  it('should receive updates from context provider', () => {
    const callback = sinon.stub()
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }
    const Test = (props) => {
      const bdux = useBdux(props)
      callback(bdux)
      return null
    }
    const Provider = (props) => (
      <div>
        <BduxContext.Provider value={props.value}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    const { rerender } = render(<Provider value={{}} />)
    rerender(<Provider value={bdux} />)

    chai.expect(callback.callCount).to.equal(2)
    chai.expect(callback.lastCall.args[0]).to.include({
      dispatch: bdux.dispatcher.dispatchAction,
      bindToDispatch: bdux.dispatcher.bindToDispatch
    })
  })

  it('should bind an action creator to dispatch', () => {
    const callback = sinon.stub()
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }
    const Test = (props) => {
      const { bindToDispatch } = useBdux(props)
      bindToDispatch(R.always({ type: 'render' }))()
      return null
    }
    const dispose = bdux.dispatcher
      .getActionStream()
      .onValue(callback)

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0])
      .to.include({ type: 'render' })
      .and.have.property('id')
    dispose()
  })

  it('should bind multiple action creators to dispatch', () => {
    const callback = sinon.stub()
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }
    const Test = (props) => {
      const { bindToDispatch } = useBdux(props)
      const creators = bindToDispatch({
        test1: R.always({ type: 'test1' }),
        test2: R.always({ type: 'test2' })
      })
      creators.test1()
      creators.test2()
      return null
    }
    const dispose = bdux.dispatcher
      .getActionStream()
      .onValue(callback)

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(callback.callCount).to.equal(2)
    chai.expect(callback.firstCall.args[0]).to.have.property('type', 'test1')
    chai.expect(callback.lastCall.args[0]).to.have.property('type', 'test2')
    dispose()
  })

  it('should dispatch a single action', () => {
    const callback = sinon.stub()
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }
    const Test = (props) => {
      const { dispatch } = useBdux(props)
      dispatch({ type: 'test' })
      return null
    }
    const dispose = bdux.dispatcher
      .getActionStream()
      .onValue(callback)

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0]).to.have.property('type', 'test')
    dispose()
  })

  it('should dispatch actions from a bacon stream', () => {
    const clock = sinon.useFakeTimers(Date.now())
    const callback = sinon.stub()
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }
    const Test = (props) => {
      const { dispatch } = useBdux(props)
      dispatch(Bacon.fromArray([
        { type: 'event1' },
        { type: 'event2' }
      ]))
      return null
    }
    const dispose = bdux.dispatcher
      .getActionStream()
      .onValue(callback)

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    clock.next()
    chai.expect(callback.callCount).to.equal(2)
    chai.expect(callback.firstCall.args[0]).to.have.property('type', 'event1')
    chai.expect(callback.lastCall.args[0]).to.have.property('type', 'event2')
    clock.restore()
    dispose()
  })

})
