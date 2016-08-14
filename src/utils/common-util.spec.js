import chai from 'chai'
import sinon from 'sinon'
import Common, {
  canUseDOM,
  isReactNative,
  getTimeFunc } from './common-util'

describe('Common Utilities', () => {

  it('should be on server when there is no window', () => {
    global.window = undefined
    chai.expect(Common.isOnServer()).to.be.true
  })

  it('should cache whether currently on server', () => {
    global.window = undefined
    Common.isOnServer()
    global.window = { document: { createElement: () => {} }}
    chai.expect(Common.isOnServer()).to.be.true
  })

  it('should not be able to use dom when there is no document', () => {
    global.window = { document: undefined }
    chai.expect(canUseDOM()).to.not.be.ok
  })

  it('should not be able to use dom when there is no function to create element', () => {
    global.window = { document: { createElement: undefined } }
    chai.expect(canUseDOM()).to.not.be.ok
  })

  it('should not be in react native when there is no window', () => {
    global.window = undefined
    chai.expect(isReactNative()).to.not.be.ok
  })

  it('should not be in react native when there is no navigator', () => {
    global.window = { navigator: undefined }
    chai.expect(isReactNative()).to.not.be.ok
  })

  it('should not be in react native when there is no product defined', () => {
    global.window = { navigator: { product: undefined } }
    chai.expect(isReactNative()).to.not.be.ok
  })

  it('should be in react native according to navigator', () => {
    global.window = { navigator: { product: 'ReactNative' } }
    chai.expect(isReactNative()).to.be.ok
  })

  it('should get time from date object', () => {
    Date.now = null
    chai.expect(getTimeFunc()).to.be.a('function')
    chai.expect(getTimeFunc()()).to.be.a('number')
  })

})
