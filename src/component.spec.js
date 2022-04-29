/* eslint-env mocha */

import * as R from 'ramda'
import chai from 'chai'
import sinon from 'sinon'
import * as Bacon from 'baconjs'
import React from 'react'
import { JSDOM } from 'jsdom'
import BduxContext from './context'
import Common from './utils/common-util'
import { act, render } from '@testing-library/react'
import { decorateToSubscribeStores, createComponent } from './component'
import { createDispatcher, getActionStream } from './dispatcher'
import { createStore } from './store'
import {
  clearMiddlewares,
  applyMiddleware } from './middleware'

const createPluggable = (log = R.F) => () => {
  const stream = new Bacon.Bus()
  return {
    input: stream,
    output: stream
      .doAction(log)
  }
}

const createLogger = (log) => ({
  decorateComponent: (Component) => (
    class extends React.Component {
      static displayName = 'Logger'

      constructor(props) {
        super(props)
        log()
      }

      render() {
        return React.createElement(
          Component, this.props)
      }
    }
  )
})

describe('Component', () => {

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

  it('should create a react component', () => {
    const Test = createComponent(R.F)
    chai.expect(Test).to.be.a('function')
    chai.expect(React.isValidElement(Test())).to.be.true
  })

  it('should create a react component without stores and callbacks', () => {
    const Test = createComponent()(R.F)
    chai.expect(Test).to.be.a('function')
    chai.expect(React.isValidElement(Test())).to.be.true
  })

  it('should decorate to stores with a react component', () => {
    const Test = decorateToSubscribeStores(R.F)
    // eslint-disable-next-line no-prototype-builtins
    chai.expect(React.Component.isPrototypeOf(Test)).to.be.true
  })

  it('should keep the component name', () => {
    const Test = createComponent(class Test extends React.Component {})
    chai.expect(Test.displayName).to.equal('Test')
  })

  it('should set the default component name', () => {
    const Test = createComponent(() => false)
    chai.expect(Test.displayName).to.equal('Component')
  })

  it('should keep the component name from displayName', () => {
    const Test = createComponent(createComponent(class Test extends React.Component {}))
    chai.expect(Test.displayName).to.equal('Test')
  })

  it('should keep the component name from type', () => {
    const Inner = () => false
    Inner.displayName = 'Inner'
    const Test = createComponent()(React.memo(Inner))
    chai.expect(Test.displayName).to.equal('Inner')
  })

  it('should have no default props', () => {
    const Test = createComponent(R.F)
    chai.expect(Test.defaultProps).to.eql({})
  })

  it('should decorate to stores without default props', () => {
    const Test = decorateToSubscribeStores(R.F)
    chai.expect(Test.defaultProps).to.eql({})
  })

  it('should have no default state', () => {
    const Test = decorateToSubscribeStores(props => JSON.stringify(props))
    const { container } = render(<Test />)
    chai.expect(container.innerHTML).to.equal('{}')
  })

  it('should render a div', () => {
    const Test = createComponent(() => <div />)
    const { container } = render(<Test />)
    chai.expect(container.innerHTML).to.equal('<div></div>')
  })

  it('should proxy props to the underlying component', () => {
    const Test = createComponent(({ className }) => <div className={ className } />)
    const { container } = render(<Test className="test" />)
    chai.expect(container.querySelector('div.test')).to.be.ok
  })

  it('should render a store property', () => {
    const callback = sinon.stub().returns(false)
    const store = createStore('name', createPluggable())
    const Test = createComponent(callback, { test: store })

    const dispose = store.getProperty()
      .map(<Test />)
      .map(render)
      .map(R.path(['container', 'innerHTML']))
      .first()
      .onValue()

    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({ test: null })
    dispose()
  })

  it('should render with multiple stores', () => {
    const callback = sinon.stub().returns(false)
    const Test = createComponent(callback, {
      test1: createStore('name1', createPluggable()),
      test2: createStore('name2', createPluggable())
    })

    const { container } = render(<Test />)
    chai.expect(container.innerHTML).to.equal('')
    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0]).to.include({
      test1: null,
      test2: null
    })
  })

  it('should unsubscribe from a store on server', () => {
    Common.isOnServer.returns(true)

    const logReduce = sinon.stub()
    const Test = createComponent(R.F, {
      test: createStore('name', createPluggable(logReduce))
    })

    render(<Test />)
    act(() => {
      getActionStream().push({})
    })
    chai.expect(logReduce.called).to.be.false
  })

  it('should unsubscribe from a store by props', () => {
    const logReduce = sinon.stub()
    const Test = createComponent(R.F, {
      test: createStore(R.prop('id'), createPluggable(logReduce))
    })

    render(<Test id="1" />).unmount()
    render(<Test id="2" />).unmount()
    act(() => {
      getActionStream().push({})
    })
    chai.expect(logReduce.called).to.be.false
  })

  it('should be decorated by middleware', () => {
    const logMount = sinon.stub()
    const logger = createLogger(logMount)
    clearMiddlewares()
    applyMiddleware(logger)

    const Test = () => (
      React.createElement(
        createComponent(() => <div />)
      )
    )

    const { container } = render(<Test />)
    chai.expect(container.innerHTML).to.equal('<div></div>')
    chai.expect(logMount.calledOnce).to.be.true
  })

  it('should subscribe to a store', () => {
    const logReduce = sinon.stub()
    const Test = createComponent(R.F, {
      test: createStore('name', createPluggable(logReduce))
    })

    render(<Test />)
    act(() => {
      getActionStream().push({})
    });
    chai.expect(logReduce.calledOnce).to.be.true
  })

  it('should subscribe to a store by props', () => {
    const logReduce = sinon.stub()
    const Test = createComponent(R.F, {
      test: createStore(R.prop('id'), createPluggable(logReduce))
    })

    render(<Test id="1" />)
    render(<Test id="2" />)
    act(() => {
      getActionStream().push({})
    })
    chai.expect(logReduce.calledTwice).to.be.true
  })

  it('should remove store by props on unmount', () => {
    const getInstance = props => ({
      name: props.id,
      isRemovable: true
    })

    const logReduce = sinon.stub()
    const store = createStore(getInstance, createPluggable(logReduce))
    const Test = createComponent(R.F, {
      test: store
    })

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

    const logReduce = sinon.stub()
    const store = createStore(getInstance, createPluggable(logReduce))
    const Test = createComponent(R.F, {
      test: store
    })

    const props = { id: '2' }
    const property1 = store.getProperty(props)
    render(<Test {...props} />).unmount()
    const property2 = store.getProperty(props)
    chai.expect(property1 === property2).to.be.true
  })

  it('should trigger a single callback after subscription', () => {
    const callback = sinon.stub()
    const Test = createComponent(R.F, {
      test: createStore('name', createPluggable())
    }, callback)

    render(<Test />)
    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0])
      .to.include({ test: null })
      .and.have.property('props')
  })

  it('should trigger a callback from rendering a store property', () => {
    const callback = sinon.stub()
    const store = createStore('name', createPluggable())
    const Test = createComponent(R.F, { test: store }, callback)

    const dispose = store.getProperty()
      .map(<Test />)
      .map(render)
      .first()
      .onValue()

    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0])
      .to.include({ test: null })
      .and.have.property('props')
    dispose()
  })

  it('should trigger multiple callbacks after subscription', () => {
    const callback1 = sinon.stub()
    const callback2 = sinon.stub()
    const Test = createComponent(R.F, {
      test: createStore('name', createPluggable())
    },
    callback1,
    callback2)

    render(<Test />)
    chai.expect(callback1.calledOnce).to.be.true
    chai.expect(callback2.calledOnce).to.be.true
    chai.expect(callback2.lastCall.args[0])
      .to.include({ test: null })
      .and.have.property('props')
  })

  it('should bind callbacks to dispatch', () => {
    const callback = sinon.stub()
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }

    const Test = createComponent(R.F, {},
      R.always({ type: 'test' }))
    const dispose = bdux.dispatcher.getActionStream()
      .onValue(callback)

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0])
      .to.include({ type: 'test' })
      .and.have.property('id')
    dispose()
  })

  it('should provide convenience to pipe decorators', () => {
    const callback1 = sinon.stub()
    const callback2 = sinon.stub()
    const decorate = createComponent(
      { test: createStore('name', createPluggable()) },
      callback1,
      callback2
    )

    const Test = decorate(R.F)
    render(<Test className="hidden" />)

    chai.expect(callback1.calledOnce).to.be.true
    chai.expect(callback2.calledOnce).to.be.true
    chai.expect(callback2.lastCall.args[0])
      .to.include({ test: null })
      .and.have.property('props')
      .to.include({ className: 'hidden' })
  })

  it('should receive value from context provider', () => {
    const callback = sinon.stub().returns(false)
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }

    const Test = createComponent(callback)
    const wrapper = render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.firstCall.args[0]).to.include({
      bdux: bdux,
      dispatch: bdux.dispatcher.dispatchAction,
      bindToDispatch: bdux.dispatcher.bindToDispatch
    })
  })

  it('should receive updates from context provider', () => {
    const callback = sinon.stub().returns(false)
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }

    const Test = createComponent(callback)
    const Provider = (props) => (
      <div>
        <BduxContext.Provider value={props.value}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    const { rerender } = render(<Provider value={{}} />)
    rerender(<Provider value={bdux} />)

    chai.expect(callback.calledTwice).to.be.true
    chai.expect(callback.lastCall.args[0]).to.include({
      bdux: bdux,
      dispatch: bdux.dispatcher.dispatchAction,
      bindToDispatch: bdux.dispatcher.bindToDispatch
    })
  })

  it('should bind an action creator to dispatch', () => {
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }

    const callback = sinon.stub()
    const dispose = bdux.dispatcher.getActionStream()
      .onValue(callback)

    const Test = createComponent(({ bindToDispatch }) => {
      bindToDispatch(R.always({ type: 'render' }))()
      return false
    })

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0])
      .to.include({ type: 'render' })
      .and.have.property('id')
    dispose()
  })

  it('should bind multiple action creators to dispatch', () => {
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }

    const callback = sinon.stub()
    const dispose = bdux.dispatcher.getActionStream()
      .onValue(callback)

    const Test = createComponent(({ bindToDispatch }) => {
      const creators = bindToDispatch({
        test1: R.always({ type: 'test1' }),
        test2: R.always({ type: 'test2' })
      })
      creators.test1()
      creators.test2()
      return false
    })

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(callback.calledTwice).to.be.true
    chai.expect(callback.firstCall.args[0]).to.have.property('type', 'test1')
    chai.expect(callback.lastCall.args[0]).to.have.property('type', 'test2')
    dispose()
  })

  it('should dispatch a single action', () => {
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }

    const callback = sinon.stub()
    const dispose = bdux.dispatcher.getActionStream()
      .onValue(callback)

    const Test = createComponent(({ dispatch }) => {
      dispatch({ type: 'test' })
      return false
    })

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    chai.expect(callback.calledOnce).to.be.true
    chai.expect(callback.lastCall.args[0]).to.have.property('type', 'test')
    dispose()
  })

  it('should dispatch actions from a bacon stream', () => {
    const clock = sinon.useFakeTimers(Date.now())
    const bdux = {
      dispatcher: createDispatcher(),
      stores: new WeakMap()
    }

    const callback = sinon.stub()
    const dispose = bdux.dispatcher.getActionStream()
      .onValue(callback)

    const Test = createComponent(({ dispatch }) => {
      dispatch(Bacon.fromArray([
        { type: 'event1' },
        { type: 'event2' }
      ]))
      return false
    })

    render(
      <div>
        <BduxContext.Provider value={bdux}>
          <Test />
        </BduxContext.Provider>
      </div>
    )

    clock.tick(1)
    chai.expect(callback.calledTwice).to.be.true
    chai.expect(callback.firstCall.args[0]).to.have.property('type', 'event1')
    chai.expect(callback.lastCall.args[0]).to.have.property('type', 'event2')
    clock.restore()
    dispose()
  })

})
