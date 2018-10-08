import * as _ from 'lodash';

export class Scope {
  constructor() {
    this.$$watchers = [];
    this.$$lastDirtyWatch = null;
    this.$$asyncQueue = [];
    this.$$applyAsyncQueue = [];
    this.$$applyAsyncId = null;
    this.$$postDigestQueue = [];
    this.$root = this;
    this.$$children = [];
    this.$$listeners = {};
    this.$$phase = null;
  }

  initializeWatchValue() {}

  $watch(watchFunction, listenerFunction, valueEquality) {
    const emptyFunction = () => {};
    const watcher = {
      watchFunction,
      // set listender to empty function if no listener passed in (using $watch to track digest)
      listenerFunction: listenerFunction || emptyFunction,
      valueEquality: !!valueEquality,
      last: this.initializeWatchValue
    };

    // add on to the end of the array
    this.$$watchers.unshift(watcher);

    //reset $$lastDirtyWatch when a watch is added (from a listener)
    this.$root.$$lastDirtyWatch = null;

    // return a function to remove a $watch
    return () => {
      const index = this.$$watchers.indexOf(watcher);
      if (index >= 0) {
        this.$$watchers.splice(index, 1);

        this.$root.$$lastDirtyWatch = null;
      }
    };
  }

  $watchGroup(watchFunctions, listenerFunction) {
    const newValues = new Array(watchFunctions.length);
    const oldValues = new Array(watchFunctions.length);
    let changeReactionScheduled = false;
    let firstRun = true;

    if (watchFunctions.length === 0) {
      let shouldCall = true;
      this.$evalAsync(() => {
        if (shouldCall) {
          listenerFunction(newValues, newValues, this);
        }
      });
      return () => (shouldCall = false);
    }

    const watchGroupListener = () => {
      if (firstRun) {
        firstRun = false;
        listenerFunction(newValues, newValues, this);
      } else {
        listenerFunction(newValues, oldValues, this);
      }

      changeReactionScheduled = false;
    };

    const destroyFunctions = _.map(watchFunctions, (watchFunction, i) => {
      return this.$watch(watchFunction, (newValue, oldValue) => {
        newValues[i] = newValue;
        oldValues[i] = oldValue;

        // only call the listener once
        if (!changeReactionScheduled) {
          changeReactionScheduled = true;
          this.$evalAsync(watchGroupListener);
        }
      });
    });

    return () => {
      _.forEach(destroyFunctions, destroyFunction => destroyFunction());
    };
  }

  $digest() {
    let dirty,
      timeToLive = 10;

    // reset $$lastDirtyWatch when digest begins
    this.$root.$$lastDirtyWatch = null;
    this.$beginPhase('$digest');

    if (this.$root.$$applyAsyncId) {
      clearTimeout(this.$root.$$applyAsyncId);
      this.$$flushApplyAsync();
    }

    do {
      // consume async queue
      while (this.$$asyncQueue.length) {
        try {
          const asyncTask = this.$$asyncQueue.shift();
          asyncTask.scope.$eval(asyncTask.expression);
        } catch (e) {
          console.log(e);
        }
      }

      dirty = this.$$digestOnce();
      if ((dirty || this.$$asyncQueue.length) && !timeToLive--) {
        this.$clearPhase();
        // throwing exception if the digest runs 10 times
        throw '10 digest iterations reached';
      }
    } while (dirty || this.$$asyncQueue.length);
    this.$clearPhase();

    // drain $$postDigest queue and invoke all functions
    while (this.$$postDigestQueue.length) {
      try {
        this.$$postDigestQueue.shift()();
      } catch (e) {
        console.log(e);
      }
    }
  }

  $$digestOnce() {
    let dirty;
    let continueLoop = true;
    // removing from the right so, if a watch is removed during the digest, it doesn't get digested twice
    this.$$everyScope(scope => {
      let newValue, oldValue;
      _.forEachRight(scope.$$watchers, watcher => {
        try {
          if (watcher) {
            // get the new value of the watch
            newValue = watcher.watchFunction(scope);
            oldValue = watcher.last;

            // if the watch is dirty
            if (!scope.$$areEqual(newValue, oldValue, watcher.valueEquality)) {
              this.$root.$$lastDirtyWatch = watcher;
              watcher.last = watcher.valueEquality
                ? _.cloneDeep(newValue)
                : newValue;

              // call the listener
              watcher.listenerFunction(
                newValue,
                // only pass the old value if it is not the initial change
                oldValue === this.initializeWatchValue ? newValue : oldValue,
                scope
              );
              dirty = true;
            } else if (this.$root.$$lastDirtyWatch === watcher) {
              return false;
            }
          }
        } catch (e) {
          console.error(e);
        }
      });
      return continueLoop;
    });
    return dirty;
  }

  $$areEqual(newValue, oldValue, valueEquality) {
    if (valueEquality) {
      return _.isEqual(newValue, oldValue);
    } else {
      return (
        newValue === oldValue ||
        (typeof newValue === 'number' &&
          typeof oldValue === 'number' &&
          isNaN(newValue) &&
          isNaN(oldValue))
      );
    }
  }

  // execute an expression in  the context of a scope
  $eval(expression, locals) {
    return expression(this, locals);
  }

  // evaluate an expression and kick off the digest cycle
  $apply(expression) {
    try {
      this.$beginPhase('$apply');
      return this.$eval(expression);
    } finally {
      this.$clearPhase();
      this.$root.$digest();
    }
  }

  // add an expression to the async queue and kick off the digest cycle at a later time
  $evalAsync(expression) {
    if (!this.$$phase && !this.$$asyncQueue.length) {
      setTimeout(() => {
        if (this.$$asyncQueue.length) {
          this.$root.$digest();
        }
      }, 0);
    }
    this.$$asyncQueue.push({ scope: this, expression });
  }

  // add an expression to the async queue and apply it at a later time
  $applyAsync(expression) {
    this.$$applyAsyncQueue.push(() => this.$eval(expression));

    if (this.$root.$$applyAsyncId === null) {
      this.$root.$$applyAsyncId = setTimeout(() => {
        this.$apply(this.$$flushApplyAsync.bind(this));
      }, 0);
    }
  }

  $$flushApplyAsync() {
    while (this.$$applyAsyncQueue.length) {
      try {
        this.$$applyAsyncQueue.shift()();
      } catch (e) {
        console.log(e);
      }
    }
    this.$root.$$applyAsyncId = null;
  }

  $beginPhase(phase) {
    if (this.$$phase) {
      throw this.$$phase + ' already in progress';
    }
    this.$$phase = phase;
  }

  $clearPhase() {
    this.$$phase = null;
  }

  $$postDigest(fn) {
    this.$$postDigestQueue.push(fn);
  }

  $new(isolated, parent) {
    let child;
    parent = parent || this;
    if (isolated) {
      child = new Scope();
      child.$root = parent.$root;
      child.$$asyncQueue = parent.$$asyncQueue;
      child.$$postDigestQueue = parent.$$postDigestQueue;
      child.$$applyAsyncQueue = parent.$$applyAsyncQueue;
    } else {
      child = Object.create(this);
    }

    parent.$$children.push(child);
    child.$$watchers = [];
    child.$$listeners = {};
    child.$$children = [];
    child.$parent = parent;
    return child;
  }

  $$everyScope(fn) {
    if (fn(this)) {
      return this.$$children.every(child => {
        return child.$$everyScope(fn);
      });
    } else {
      return false;
    }
  }

  $destroy() {
    this.$broadcast('$destroy');
    if (this.$parent) {
      const siblings = this.$parent.$$children;
      const indexOfThis = siblings.indexOf(this);
      if (indexOfThis >= 0) {
        siblings.splice(indexOfThis, 1);
      }
    }
    this.$$watchers = null;
    this.$$listeners = {};
  }

  $watchCollection(watchFuntion, listenerFunction) {
    let newValue,
      oldValue,
      oldLength,
      veryOldValue,
      trackVeryOldValue = listenerFunction.length > 1,
      changeCount = 0,
      firstRun = true;

    const internalWatchFunction = scope => {
      let newLength;
      newValue = watchFuntion(scope);

      if (_.isObject(newValue)) {
        if (this.isArrayLike(newValue)) {
          if (!_.isArray(oldValue)) {
            changeCount++;
            oldValue = [];
          }

          if (newValue.length !== oldValue.length) {
            changeCount++;
            oldValue.length = newValue.length;
          }

          _.forEach(newValue, (newItem, i) => {
            const bothNaN = _.isNaN(newItem) && _.isNaN(oldValue[i]);
            if (!bothNaN && newItem !== oldValue[i]) {
              changeCount++;
              oldValue[i] = newItem;
            }
          });
        } else {
          if (!_.isObject(oldValue) || this.isArrayLike(oldValue)) {
            changeCount++;
            oldValue = {};
            oldLength = 0;
          }
          newLength = 0;
          _.forOwn(newValue, (value, key) => {
            newLength++;
            if (oldValue.hasOwnProperty(key)) {
              const bothNaN = _.isNaN(value) && _.isNaN(oldValue[key]);
              if (!bothNaN && oldValue[key] !== value) {
                changeCount++;
                oldValue[key] = value;
              }
            } else {
              changeCount++;
              oldLength++;
              oldValue[key] = value;
            }
          });
          if (oldLength > newLength) {
            changeCount++;
            _.forOwn(oldValue, (value, key) => {
              if (!newValue.hasOwnProperty(key)) {
                oldLength--;
                delete oldValue[key];
              }
            });
          }
        }
      } else {
        if (!this.$$areEqual(newValue, oldValue, false)) {
          changeCount++;
        }

        oldValue = newValue;
      }

      return changeCount;
    };
    const internalListenerFunction = () => {
      if (firstRun) {
        listenerFunction(newValue, newValue, this);
        firstRun = false;
      } else {
        listenerFunction(newValue, veryOldValue, this);
      }

      if (trackVeryOldValue) {
        veryOldValue = _.clone(newValue);
      }
    };

    return this.$watch(internalWatchFunction, internalListenerFunction);
  }

  isArrayLike(object) {
    if ((_.isNull(object) || _, _.isUndefined(object))) {
      return false;
    }
    const length = object.length;
    return (
      length === 0 || (_.isNumber(length) && length > 0 && length - 1 in object)
    );
  }

  $on(eventName, listener) {
    let listeners = this.$$listeners[eventName];
    if (!listeners) {
      this.$$listeners[eventName] = listeners = [];
    }
    listeners.push(listener);

    return () => {
      const index = listeners.indexOf(listener);
      if (index >= 0) {
        listeners[index] = null;
      }
    };
  }

  $emit(eventName) {
    let propagationStopped = false;
    const event = {
      name: eventName,
      targetScope: this,
      stopPropagation: () => (propagationStopped = true),
      preventDefault: () => (event.defaultPrevented = true)
    };
    const listenerArguments = [event].concat(_.tail(arguments));
    let scope = this;
    do {
      event.currentScope = scope;
      scope.$$fireEventOnScope(eventName, listenerArguments);
      scope = scope.$parent;
    } while (scope && !propagationStopped);

    event.currentScope = null;
    return event;
  }

  $broadcast(eventName) {
    const event = {
      name: eventName,
      targetScope: this,
      preventDefault: () => (event.defaultPrevented = true)
    };
    const listenerArguments = [event].concat(_.tail(arguments));
    this.$$everyScope(scope => {
      event.currentScope = scope;
      scope.$$fireEventOnScope(eventName, listenerArguments);
      return true;
    });

    event.currentScope = null;
    return event;
  }

  $$fireEventOnScope(eventName, listenerArguments) {
    const listeners = this.$$listeners[eventName] || [];
    let i = 0;
    while (i < listeners.length) {
      if (listeners[i] === null) {
        listeners.splice(i, 1);
      } else {
        try {
          listeners[i].apply(null, listenerArguments);
        } catch (e) {
          console.error(e);
        }
        i++;
      }
    }

    return event;
  }
}
