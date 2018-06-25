/* eslint-env mocha */

import chai from 'chai'
import BduxContext, { defaultContextValue } from './context'

describe('Context', () => {

  it('should export a provider', () => {
    chai.expect(BduxContext).to.have.property('Provider')
  })

  it('should export a consumer', () => {
    chai.expect(BduxContext).to.have.property('Consumer')
  })

  it('should have dispatcher in the default context', () => {
    chai.expect(defaultContextValue).to.have.property('dispatcher')
      .to.be.an('object')
      .to.include.keys([
        'generateActionId',
        'getActionStream',
        'dispatchAction',
        'bindToDispatch'
      ])
  })

  it('should have a weak map to memoise store proeprties', () => {
    chai.expect(defaultContextValue).to.have.property('stores')
      .to.be.an.instanceof(WeakMap)
  })

})
