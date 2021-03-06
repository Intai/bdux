/* eslint-env mocha */

import * as R from 'ramda'
import chai from 'chai'
import sinon from 'sinon'
import * as Bacon from 'baconjs'
import React from 'react'
import { JSDOM } from 'jsdom'
import BduxContext from './context'
import Common from './utils/common-util'
import { render, shallow, mount } from 'enzyme'
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
    sandbox = sinon.createSandbox()
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
    const Test = decorateToSubscribeStores(R.F)
    const wrapper = shallow(<Test />)
    chai.expect(wrapper.state()).to.eql({})
  })

  it('should create dispose function', () => {
    const Test = decorateToSubscribeStores(R.F)
    const wrapper = shallow(<Test />)
    chai.expect(wrapper.instance()).to.have.property('dispose')
      .and.is.a('function')
  })

  it('should render a div', () => {
    const Test = createComponent(() => (<div />))
    const wrapper = render(<Test />)
    chai.expect(wrapper.is('div')).to.be.true
  })

  it('should proxy props to the underlying component', () => {
    const Test = createComponent(({ className }) => (<div className={ className } />))
    const wrapper = render(<Test className={ 'test' } />)
    chai.expect(wrapper.is('div.test')).to.be.true
  })

  it('should render a store property', () => {
    const callback = sinon.stub().returns(false)
    const store = createStore('name', createPluggable())
    const Test = createComponent(callback, { test: store })

    const dispose = store.getProperty()
      .map(<Test />)
      .map(shallow)
      .map(R.invoker(0, 'html'))
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

    shallow(<Test />).html()
    chai.expect(callback.callCount).to.equal(1)
    chai.expect(callback.lastCall.args[0]).to.include({
      test1: null,
      test2: null
    })
  })

  it('should unsubscribe from a store', () => {
    sandbox.stub(Common, 'isOnServer')
      .returns(true)

    const logReduce = sinon.stub()
    const Test = createComponent(R.F, {
      test: createStore('name', createPluggable(logReduce))
    })

    shallow(<Test />)
    getActionStream().push({})
    chai.expect(logReduce.called).to.be.false
  })

  it('should unsubscribe from a store by props', () => {
    sandbox.stub(Common, 'isOnServer')
      .returns(false)

    const logReduce = sinon.stub()
    const Test = createComponent(R.F, {
      test: createStore(R.prop('id'), createPluggable(logReduce))
    })

    shallow(<Test id="1" />).unmount()
    shallow(<Test id="2" />).unmount()
    getActionStream().push({})
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

    const wrapper = shallow(<Test />)
    chai.expect(wrapper.name()).to.equal('Logger')
    chai.expect(wrapper.html()).to.equal('<div></div>')
    chai.expect(logMount.calledOnce).to.be.true
  })

  describe('with jsdom', () => {

    beforeEach(() => {
      const dom = new JSDOM('<html></html>')
      global.window = dom.window
      global.document = dom.window.document
      global.Element = dom.window.Element
    })

    it('should subscribe to a store', () => {
      sandbox.stub(Common, 'isOnServer')
        .returns(false)

      const logReduce = sinon.stub()
      const Test = createComponent(R.F, {
        test: createStore('name', createPluggable(logReduce))
      })

      mount(<Test />)
      getActionStream().push({})
      chai.expect(logReduce.calledOnce).to.be.true
    })

    it('should subscribe to a store by props', () => {
      sandbox.stub(Common, 'isOnServer')
        .returns(false)

      const logReduce = sinon.stub()
      const Test = createComponent(R.F, {
        test: createStore(R.prop('id'), createPluggable(logReduce))
      })

      mount(<Test id="1" />)
      mount(<Test id="2" />)
      getActionStream().push({})
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

      const wrapper = mount(<Test id="1" />)
      const props = wrapper.props()
      const property1 = store.getProperty(props)
      wrapper.unmount()
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

      const property1 = store.getProperty({ id: '2' })
      mount(<Test id="2" />).unmount()
      const property2 = store.getProperty({ id: '2' })
      chai.expect(property1 === property2).to.be.true
    })

    it('should trigger a single callback after subscription', () => {
      const callback = sinon.stub()
      const Test = createComponent(R.F, {
        test: createStore('name', createPluggable())
      }, callback)

      mount(<Test />)
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
        .map(mount)
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

      mount(<Test />)
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

      mount(
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
      mount(<Test className="hidden" />)

      chai.expect(callback1.calledOnce).to.be.true
      chai.expect(callback2.calledOnce).to.be.true
      chai.expect(callback2.lastCall.args[0])
        .to.include({ test: null })
        .and.have.property('props')
        .to.include({ className: 'hidden' })
    })

    it('should receive value from context provider', () => {
      const bdux = {
        dispatcher: createDispatcher(),
        stores: new WeakMap()
      }

      const Test = createComponent(R.F)
      const wrapper = mount(
        <div>
          <BduxContext.Provider value={bdux}>
            <Test />
          </BduxContext.Provider>
        </div>
      )

      chai.expect(wrapper.find(Test).childAt(0).props()).to.include({
        bdux: bdux,
        dispatch: bdux.dispatcher.dispatchAction,
        bindToDispatch: bdux.dispatcher.bindToDispatch
      })
    })

    it('should receive updates from context provider', () => {
      const bdux = {
        dispatcher: createDispatcher(),
        stores: new WeakMap()
      }

      const Test = createComponent(R.F)
      const Provider = (props) => (
        <div>
          <BduxContext.Provider value={props.value}>
            <Test />
          </BduxContext.Provider>
        </div>
      )

      const wrapper = mount(<Provider value={{}}/>)
      wrapper.setProps({ value: bdux })

      chai.expect(wrapper.find(Test).childAt(0).props()).to.include({
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

      mount(
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

      mount(
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

      mount(
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

      mount(
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

  afterEach(() => {
    sandbox.restore()
  })

})
