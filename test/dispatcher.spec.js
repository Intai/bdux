import chai from 'chai';
import sinon from 'sinon';
import Bacon from 'baconjs';
import { bindToDispatch, getActionStream } from '../src/main';

describe('Dispatcher', () => {

  it('should return an action stream', () => {
    let stream = getActionStream();
    chai.expect(stream).to.be.instanceof(Bacon.Observable);
  });

  it('should include action id', () => {
    let callback = sinon.stub();
    getActionStream().onValue(callback);
    bindToDispatch(() => ({}))();

    chai.expect(callback.calledOnce).to.be.true;
    chai.expect(callback.lastCall.args[0]).to.have.property('id')
      .that.is.a('number');
  });

  it('should bind a single action creator', () => {
    let callback = sinon.stub();
    getActionStream().onValue(callback);
    bindToDispatch(() => ({ type: 'test' }))();

    chai.expect(callback.calledOnce).to.be.true;
    chai.expect(callback.lastCall.args[0]).to.include({
      type: 'test'
    });
  });

});
