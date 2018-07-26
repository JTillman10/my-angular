import * as _ from 'lodash';

export class Scope {
  constructor() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
  }

  initializeWatchValue() {}

  $watch(watchFunction, listenerFunction, valueEquality) {
    const emptyFunction = () => {};
    // add a watcher
    this.$$watchers.push({
      watchFunction,
      listenerFunction: listenerFunction || emptyFunction,
      valueEquality: !!valueEquality,
      last: this.initializeWatchValue
    });

    this.$$lastDirtyWatch = null;
  }

  $digest() {
    let dirty, timeToLive = 10;
    this.$$lastDirtyWatch = null;

    do {
      dirty = this.$$digestOnce();
      if (dirty && !(timeToLive--)) {
        // throwing exception if the digest runs 10 times
        throw '10 digest iterations reached';
      }
    } while (dirty);
  }

  $evaluated(expression, locals) {
    return expression(this, locals);
  }

  $apply(expression) {
    try {
      return this.$evaluated(expression);
    } finally {
      this.$digest();
    }
  }

  $$digestOnce() {
    let dirty;
    _.forEach(this.$$watchers, (watcher) => {
      // get the new value of the watch
      const newValue = watcher.watchFunction(this);
      const oldValue = watcher.last;

      // dirty watch
      if (!this.$$areEqual(newValue, oldValue, watcher.valueEquality)) {
        this.$$lastDirtyWatch = watcher;
        watcher.last = (watcher.valueEquality ? _.cloneDeep(newValue) : newValue);

        // call the listener
        watcher.listenerFunction(
          newValue,
          // only pass the old value if it is not the initial change
          (oldValue === this.initializeWatchValue ? newValue : oldValue) ,
          this
        );
        dirty = true;
      } else if (this.$$lastDirtyWatch === watcher) {
        return false;
      }
    });
    return dirty;
  }

  $$areEqual(newValue, oldValue, valueEquality) {
    if (valueEquality) {
      return _.isEqual(newValue, oldValue);
    } else {
      return newValue === oldValue ||
        (typeof newValue === 'number' && typeof oldValue === 'number' && isNaN(newValue) && isNaN(oldValue));
    }
  }
}