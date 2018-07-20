import Enzyme from 'enzyme'
import Adapter from 'enzyme-react-adapter-future'

Enzyme.configure({
  adapter: new Adapter()
})
