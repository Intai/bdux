import R from 'ramda';

export default {

  canUseDOM: R.once(() => (
    typeof window !== 'undefined'
      && window.document
      && window.document.createElement
  ))
};
