import * as _ from 'lodash';

import { Scope } from '../src/scope';

describe('Scope', () => {
  let scope;

  beforeEach(() => {
    scope = new Scope();
  });

  it('can be constructed and used as an object', () => {
    let scope = new Scope();
    scope.aProperty = 1;

    expect(scope.aProperty).toBe(1);
  });

  describe('digest', () => {
    it('calls the listener function of  watch on first $digest', () => {
      const watchFunction = () => 'wat';
      const listenerFunction = jasmine.createSpy();
      scope.$watch(watchFunction, listenerFunction);

      scope.$digest();

      expect(listenerFunction).toHaveBeenCalled();
    });

    it('calls the watch function with the scope as the argument', () => {
      const watchFunction = jasmine.createSpy();
      const listenerFunction = () => {};
      scope.$watch(watchFunction, listenerFunction);

      scope.$digest();

      expect(watchFunction).toHaveBeenCalledWith(scope);
    });

    it('calls the listener function when the watched value changes', () => {
      scope.someValue = 'a';
      scope.counter = 0;

      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      expect(scope.counter).toBe(0);

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.someValue = 'b';
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('calls listener when watch value is first undefined', () => {
      scope.counter = 0;

      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('calls listener with new value as old value the first time', () => {
      scope.someValue = 123;
      let oldValueGiven;

      scope.$watch(
        scope => scope.someValue,
        (newValue, oldValue, scope) => (oldValueGiven = oldValue)
      );

      scope.$digest();
      expect(oldValueGiven).toBe(123);
    });

    it('may have watchers that omit the listnener function', () => {
      const watchFunction = jasmine.createSpy().and.returnValue('something');
      scope.$watch(watchFunction);

      scope.$digest();

      expect(watchFunction).toHaveBeenCalled();
    });

    it('triggers chained watchers in the same digest', () => {
      scope.name = 'Jane';

      scope.$watch(
        scope => scope.nameUpper,
        (newValue, oldValue, scope) => {
          if (newValue) {
            scope.initial = newValue.substring(0, 1) + '.';
          }
        }
      );

      scope.$watch(
        scope => scope.name,
        (newValue, oldValue, scope) => {
          if (newValue) {
            scope.nameUpper = newValue.toUpperCase();
          }
        }
      );

      scope.$digest();
      expect(scope.initial).toBe('J.');

      scope.name = 'Bob';
      scope.$digest();
      expect(scope.initial).toBe('B.');
    });

    it('gives up on the watches after 10 iterations', () => {
      scope.counterA = 0;
      scope.counterB = 0;

      scope.$watch(
        scope => scope.counterA,
        (newValue, oldValue, scope) => scope.counterB++
      );

      scope.$watch(
        scope => scope.counterB,
        (newValue, oldValue, scope) => scope.counterA++
      );

      expect(() => {
        scope.$digest();
      }).toThrow();
    });

    it('ends the digest when the last watch is clean', () => {
      scope.array = _.range(100);
      let watchExecutions = 0;

      _.times(100, i => {
        scope.$watch(
          scope => {
            watchExecutions++;
            return scope.array[i];
          },
          (newValue, oldValue, scope) => {}
        );
      });

      scope.$digest();
      expect(watchExecutions).toBe(200);

      scope.array[0] = 420;
      scope.$digest();
      expect(watchExecutions).toBe(301);
    });

    it('does not end digest so that new watches are not run', () => {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.$watch(
            scope => scope.aValue,
            (newValue, oldValue, scope) => scope.counter++
          );
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('compares based on value if enabled', () => {
      scope.aValue = [1, 2, 3];
      scope.counter = 0;

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++,
        true
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('correctly handles NaNs', () => {
      scope.number = 0 / 0;
      scope.counter = 0;

      scope.$watch(
        scope => scope.number,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('catches exceptions in watch functions and continues', () => {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        scope => {
          throw 'Error';
        },
        (newValue, oldValue, scope) => {}
      );

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('catches exceptions in listern functions and continues', () => {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => {
          throw 'Error';
        }
      );

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('allows destroying a $watch with a removal function', () => {
      scope.aValue = 'abc';
      scope.counter = 0;

      const destroyWatch = scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.aValue = 'def';
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.aValue = 'ghi';
      destroyWatch();
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('allows destroying a $watch during a digest', () => {
      scope.aValue = 'abc';
      const watchCalls = [];

      scope.$watch(scope => {
        watchCalls.push('first');
        return scope.aValue;
      });

      const destroyWatch = scope.$watch(scope => {
        watchCalls.push('second');
        destroyWatch();
      });

      scope.$watch(scope => {
        watchCalls.push('third');
        return scope.aValue;
      });

      scope.$digest();
      expect(watchCalls).toEqual([
        'first',
        'second',
        'third',
        'first',
        'third'
      ]);
    });

    it('allows a $watch to destroy another during digest', () => {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => destroyWatch()
      );

      const destroyWatch = scope.$watch(
        scope => {},
        (newValue, oldValue, scope) => {}
      );

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('allows destroying several $watches during digest', () => {
      scope.aValue = 'abc';
      scope.counter = 0;

      const destroyWatch1 = scope.$watch(scope => {
        destroyWatch1();
        destroyWatch2();
      });

      const destroyWatch2 = scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$digest();
      expect(scope.counter).toBe(0);
    });

    it('has a $$phase field whose value is the current digest phase', () => {
      scope.aValue = [1, 2, 3];
      scope.phaseInWatchFunction = undefined;
      scope.phaseInListenFunction = undefined;
      scope.phaseInApplyFunction = undefined;

      scope.$watch(
        scope => {
          scope.phaseInWatchFunction = scope.$$phase;
          return scope.aValue;
        },
        (newValue, oldValue, scope) =>
          (scope.phaseInListenFunction = scope.$$phase)
      );

      scope.$apply(scope => (scope.phaseInApplyFunction = scope.$$phase));

      expect(scope.phaseInWatchFunction).toBe('$digest');
      expect(scope.phaseInListenFunction).toBe('$digest');
      expect(scope.phaseInApplyFunction).toBe('$apply');
    });
  });

  describe('$eval', () => {
    it('executes $eval function and returns result', () => {
      scope.aValue = 42;
      const result = scope.$eval(scope => {
        return scope.aValue;
      });

      expect(result).toBe(42);
    });

    it('passes the second $eval argument straight through', () => {
      scope.aValue = 42;

      const result = scope.$eval((scope, arg) => {
        return scope.aValue + arg;
      }, 2);

      expect(result).toBe(44);
    });
  });

  describe('$apply', () => {
    it('executes the given function and starts the digest', () => {
      scope.aValue = 'someValue';
      scope.counter = 0;

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$apply(scope => (scope.aValue = 'someOtherValue'));

      expect(scope.counter).toBe(2);
    });
  });

  describe('$evalAsync', () => {
    let scope;

    beforeEach(() => {
      scope = new Scope();
    });

    it('executes given function later in the same cycle', () => {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;
      scope.asyncEvaluatedImmediately = false;

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.$evalAsync(scope => (scope.asyncEvaluated = true));
          scope.asyncEvaluatedImmediately = scope.asyncEvaluated;
        }
      );

      scope.$digest();
      expect(scope.asyncEvaluated).toBe(true);
      expect(scope.asyncEvaluatedImmediately).toBe(false);
    });

    it('executes $evalAsynced functions added by watch functions', () => {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluated = false;

      scope.$watch(
        scope => {
          if (!scope.asyncEvaluated) {
            scope.$evalAsync(scope => (scope.asyncEvaluated = true));
          }
          return scope.aValue;
        },
        (newValue, oldValue, scope) => {}
      );

      scope.$digest();
      expect(scope.asyncEvaluated).toBe(true);
    });

    it('executes $evalAsynced functions even when not dirty', () => {
      scope.aValue = [1, 2, 3];
      scope.asyncEvaluatedTimes = 0;

      scope.$watch(scope => {
        if (scope.asyncEvaluatedTimes < 2) {
          scope.$evalAsync(scope => scope.asyncEvaluatedTimes++);
        }
        return scope.aValue;
      });

      scope.$digest();

      expect(scope.asyncEvaluatedTimes).toBe(2);
    });

    it('eventually halts $evalAsyncs added by watches', () => {
      scope.aValue = [1, 2, 3];

      scope.$watch(
        scope => {
          scope.$evalAsync(scope => {});
          return scope.aValue;
        },
        (newValue, oldValue, scope) => {}
      );

      expect(() => {
        scope.$digest();
      }).toThrow();
    });

    it('schedules a digest in $evalAsync', done => {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$evalAsync(scope => {});

      expect(scope.counter).toBe(0);
      setTimeout(() => {
        expect(scope.counter).toBe(1);
        done();
      }, 50);
    });

    it('catches exceptions in $evalAsync', done => {
      scope.aValue = 'abc';
      scope.counter = 0;

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$evalAsync(scope => {
        throw 'Error';
      });

      setTimeout(() => {
        expect(scope.counter).toBe(1);
        done();
      }, 50);
    });
  });

  describe('$applyAsync', () => {
    it('allows async $apply with $applyAsync', done => {
      scope.counter = 0;

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$applyAsync(scope => (scope.aValue = 'abc'));
      expect(scope.counter).toBe(1);

      setTimeout(() => {
        expect(scope.counter).toBe(2);
        done();
      }, 50);
    });

    it('never exucutes $applyAsynced function in the same cycle', done => {
      scope.aValue = [1, 2, 3];
      scope.asyncApplied = false;

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) =>
          scope.$applyAsync(scope => (scope.asyncApplied = true))
      );

      scope.$digest();
      expect(scope.asyncApplied).toBe(false);

      setTimeout(() => {
        expect(scope.asyncApplied).toBe(true);
        done();
      }, 50);
    });

    it('coalesces many calls to $applyAsync', done => {
      scope.counter = 0;

      scope.$watch(
        scope => {
          scope.counter++;
          return scope.aValue;
        },
        (newValue, oldValue, scope) => {}
      );

      scope.$applyAsync(scope => (scope.aValue = 'abc'));
      scope.$applyAsync(scope => (scope.aValue = 'def'));

      setTimeout(() => {
        expect(scope.counter).toBe(2);
        done();
      }, 50);
    });

    it('cancels and flushes $applyAsync if digested first', done => {
      scope.counter = 0;

      scope.$watch(
        scope => {
          scope.counter++;
          return scope.aValue;
        },
        (newValue, oldValue, scope) => {}
      );

      scope.$applyAsync(scope => (scope.aValue = 'abc'));
      scope.$applyAsync(scope => (scope.aValue = 'def'));

      scope.$digest();
      expect(scope.counter).toBe(2);
      expect(scope.aValue).toBe('def');

      setTimeout(() => {
        expect(scope.counter).toBe(2);
        done();
      }, 50);
    });

    it('catches exceptions in $applyAsync', done => {
      scope.$applyAsync(scope => {
        throw 'Error';
      });

      scope.$applyAsync(scope => {
        throw 'Error';
      });

      scope.$applyAsync(scope => (scope.applied = true));

      setTimeout(() => {
        expect(scope.applied).toBe(true);
        done();
      }, 50);
    });
  });

  describe('$$postDigest', () => {
    it('runs after each digest', () => {
      scope.counter = 0;
      scope.$$postDigest(() => scope.counter++);

      expect(scope.counter).toBe(0);
      scope.$digest();

      expect(scope.counter).toBe(1);
      scope.$digest();

      expect(scope.counter).toBe(1);
    });

    it('does not include $$postDigest in the digest', () => {
      scope.aValue = 'original value';

      scope.$$postDigest(() => (scope.aValue = 'changed value'));

      scope.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => (scope.watchedValue = newValue)
      );

      scope.$digest();
      expect(scope.watchedValue).toBe('original value');

      scope.$digest();
      expect(scope.watchedValue).toBe('changed value');
    });

    it('catches exceptions in $$postDigest', () => {
      let didRun = false;

      scope.$$postDigest(() => {
        throw 'Error';
      });

      scope.$$postDigest(() => (didRun = true));

      scope.$digest();
      expect(didRun).toBe(true);
    });
  });

  describe('$watchGroup', () => {
    it('takes watches as an array and calls listener with array', () => {
      let gotNewValues, gotOldValues;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup(
        [scope => scope.aValue, scope => scope.anotherValue],
        (newValues, oldValues, scope) => {
          gotNewValues = newValues;
          gotOldValues = oldValues;
        }
      );

      scope.$digest();

      expect(gotNewValues).toEqual([1, 2]);
      expect(gotOldValues).toEqual([1, 2]);
    });

    it('only calls listener once per digest', () => {
      let counter = 0;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup(
        [scope => scope.aValue, scope => scope.anotherValue],
        (newValues, oldValues, scope) => {
          counter++;
        }
      );

      scope.$digest();

      expect(counter).toEqual(1);
    });

    it('uses the same array of old and new values on first run', () => {
      let gotNewValues, gotOldValues;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup(
        [scope => scope.aValue, scope => scope.anotherValue],
        (newValues, oldValues, scope) => {
          gotNewValues = newValues;
          gotOldValues = oldValues;
        }
      );

      scope.$digest();

      expect(gotNewValues).toBe(gotOldValues);
    });

    it('uses different arrays for old and new values on subsequent runs', () => {
      let gotNewValues, gotOldValues;

      scope.aValue = 1;
      scope.anotherValue = 2;

      scope.$watchGroup(
        [scope => scope.aValue, scope => scope.anotherValue],
        (newValues, oldValues, scope) => {
          gotNewValues = newValues;
          gotOldValues = oldValues;
        }
      );

      scope.$digest();

      scope.anotherValue = 3;
      scope.$digest();

      expect(gotNewValues).toEqual([1, 3]);
      expect(gotOldValues).toEqual([1, 2]);
    });

    it('calls the listener once when the watch array is empty', () => {
      let gotNewValues, gotOldValues;

      scope.$watchGroup([], (newValues, oldValues, scope) => {
        gotNewValues = newValues;
        gotOldValues = oldValues;
      });
      scope.$digest();

      expect(gotNewValues).toEqual([]);
      expect(gotOldValues).toEqual([]);
    });

    it('cant be deregisterd', () => {
      let counter = 0;

      scope.aValue = 1;
      scope.anotherValue = 2;

      const destroyGroup = scope.$watchGroup(
        [scope => scope.aValue, scope => scope.anotherValue],
        (newValues, oldValues, scope) => {
          counter++;
        }
      );

      scope.$digest();

      scope.anotherValue = 3;
      destroyGroup();
      scope.$digest();

      expect(counter).toEqual(1);
    });

    it('does not call the zero-watch listener when deregistered first', () => {
      let counter = 0;

      const destroyGroup = scope.$watch(
        [],
        (newValues, oldValues, scope) => counter++
      );
      destroyGroup();
      scope.$digest();

      expect(counter).toEqual(0);
    });
  });

  describe('inheritence', () => {
    it("inherits the parent's properties", () => {
      const parent = new Scope();
      parent.aValue = [1, 2, 3];

      const child = parent.$new();

      expect(child.aValue).toEqual([1, 2, 3]);
    });

    it("does not cause a parent to inherit a child's properties", () => {
      const parent = new Scope();

      const child = parent.$new();
      child.aValue = [1, 2, 3];

      expect(parent.aValue).toBeUndefined();
    });

    it("inhertis the parent's properties whenever they are defined", () => {
      const parent = new Scope();
      const child = parent.$new();

      parent.aValue = [1, 2, 3];

      expect(child.aValue).toEqual([1, 2, 3]);
    });

    it("can manipulate a parent scope's property", () => {
      const parent = new Scope();
      const child = parent.$new();
      parent.aValue = [1, 2, 3];

      child.aValue.push(4);

      expect(child.aValue).toEqual([1, 2, 3, 4]);
      expect(parent.aValue).toEqual([1, 2, 3, 4]);
    });

    it('it can watch a property in the parent', () => {
      const parent = new Scope();
      const child = parent.$new();
      parent.aValue = [1, 2, 3];
      child.counter = 0;

      child.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++,
        true
      );

      child.$digest();
      expect(child.counter).toBe(1);

      parent.aValue.push(4);
      child.$digest();
      expect(child.counter).toBe(2);
    });

    it('can be nested at any depth', () => {
      const a = new Scope();
      const aa = a.$new();
      const ab = a.$new();
      const aaa = aa.$new();
      const aab = aa.$new();
      const abb = ab.$new();

      a.value = 1;

      expect(aa.value).toBe(1);
      expect(aaa.value).toBe(1);
      expect(aab.value).toBe(1);
      expect(ab.value).toBe(1);
      expect(abb.value).toBe(1);

      ab.anotherValue = 2;

      expect(abb.anotherValue).toBe(2);
      expect(aa.anotherValue).toBeUndefined();
      expect(aaa.anotherValue).toBeUndefined();
    });

    it("shadows a parent's property with the same name", () => {
      const parent = new Scope();
      const child = parent.$new();

      parent.name = 'Joe';
      child.name = 'Jill';

      expect(child.name).toBe('Jill');
      expect(parent.name).toBe('Joe');
    });

    it("does not shadow members of a parent scope's attributes", () => {
      const parent = new Scope();
      const child = parent.$new();

      parent.user = { name: 'Joe' };
      child.user.name = 'Jill';

      expect(child.user.name).toBe('Jill');
      expect(parent.user.name).toBe('Jill');
    });

    it("does not digest its parent('s) watches", () => {
      const parent = new Scope();
      const child = parent.$new();

      parent.aValue = 'abc';
      parent.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => (scope.aValueWas = newValue)
      );

      child.$digest();
      expect(child.aValueWas).toBeUndefined();
    });

    it("keeps a record of it's children", () => {
      const parent = new Scope();
      const child1 = parent.$new();
      const child2 = parent.$new();
      const child2_1 = child2.$new();

      expect(parent.$$children.length).toBe(2);
      expect(parent.$$children[0]).toBe(child1);
      expect(parent.$$children[1]).toBe(child2);

      expect(child1.$$children.length).toBe(0);

      expect(child2.$$children.length).toBe(1);
      expect(child2.$$children[0]).toBe(child2_1);
    });

    it("digests it's children", () => {
      const parent = new Scope();
      const child = parent.$new();

      parent.aValue = 'abc';

      parent.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => (scope.aValueWas = newValue)
      );

      parent.$digest();
      expect(child.aValueWas).toBe('abc');
    });

    it('digests from root on $apply', () => {
      const parent = new Scope();
      const child1 = parent.$new();
      const child2 = child1.$new();

      parent.aValue = 'abc';
      parent.counter = 0;
      parent.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      child2.$apply(scope => {});

      expect(parent.counter).toBe(1);
    });

    it('schedules a digest from root on $evalAsync', done => {
      const parent = new Scope();
      const child1 = parent.$new();
      const child2 = child1.$new();

      parent.aValue = 'abc';
      parent.counter = 0;
      parent.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      child2.$evalAsync(scope => {});

      setTimeout(() => {
        expect(parent.counter).toBe(1);
        done();
      }, 50);
    });

    it('does not have access to parent attributes when isolated', () => {
      const parent = new Scope();
      const child = parent.$new(true);

      parent.aValue = 'abc';

      expect(child.aValue).toBeUndefined();
    });

    it('cannot watch parent attributes when isolated', () => {
      const parent = new Scope();
      const child = parent.$new(true);

      parent.aValue = 'abc';
      child.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => (scope.aValueWas = newValue)
      );

      child.$digest();
      expect(child.aValueWas).toBeUndefined();
    });

    it("digests it's isolated children", () => {
      const parent = new Scope();
      const child = parent.$new(true);

      child.aValue = 'abc';
      child.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => (scope.aValueWas = newValue)
      );

      parent.$digest();
      expect(child.aValueWas).toBe('abc');
    });

    it('digests from root on $apply when isolated', () => {
      const parent = new Scope();
      const child = parent.$new(true);
      const child2 = child.$new();

      parent.aValue = 'abc';
      parent.counter = 0;
      parent.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      child2.$apply(scope => {});

      expect(parent.counter).toBe(1);
    });

    it('schedules a digest from root on $evalAsync when isolated', done => {
      const parent = new Scope();
      const child = parent.$new(true);
      const child2 = child.$new();

      parent.aValue = 'abc';
      parent.counter = 0;
      parent.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++
      );

      child2.$evalAsync(scope => {});

      setTimeout(() => {
        expect(parent.counter).toBe(1);
        done();
      }, 50);
    });

    it('executes $evalAsync functions on isolated scopes', done => {
      const parent = new Scope();
      const child = parent.$new(true);

      child.$evalAsync(scope => (scope.didEvalAsync = true));

      setTimeout(() => {
        expect(child.didEvalAsync).toBe(true);
        done();
      }, 50);
    });

    it('executes $$postDigest functions on isolated scopes', () => {
      const parent = new Scope();
      const child = parent.$new(true);

      child.$$postDigest(() => (child.didPostDigest = true));

      parent.$digest();
      expect(child.didPostDigest).toBe(true);
    });

    it('executes $applyAsync functions on isolated scopes', () => {
      const parent = new Scope();
      const child = parent.$new(true);
      let applied = false;

      parent.$applyAsync(() => (applied = true));
      child.$digest();
      expect(applied).toBe(true);
    });

    it('can take some other scope as the parent', () => {
      const prototypeParent = new Scope();
      const hierarchyParent = new Scope();
      const child = prototypeParent.$new(false, hierarchyParent);

      prototypeParent.a = 42;
      expect(child.a).toBe(42);

      child.counter = 0;
      child.$watch(scope => {
        scope.counter++;
      });

      prototypeParent.$digest();
      expect(child.counter).toBe(0);

      hierarchyParent.$digest();
      expect(child.counter).toBe(2);
    });

    it('is no longer digested when $destroy has been called', () => {
      const parent = new Scope();
      const child = parent.$new();

      child.aValue = [1, 2, 3];
      child.counter = 0;
      child.$watch(
        scope => scope.aValue,
        (newValue, oldValue, scope) => scope.counter++,
        true
      );

      parent.$digest();
      expect(child.counter).toBe(1);

      child.aValue.push(4);
      parent.$digest();
      expect(child.counter).toBe(2);

      child.$destroy();
      child.aValue.push(5);
      parent.$digest();
      expect(child.counter).toBe(2);
    });
  });

  describe('$watchCollection', () => {
    let scope;

    beforeEach(() => {
      scope = new Scope();
    });

    it('works like a normal watch for non-collections', () => {
      let valueProvided;

      scope.aValue = 42;
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.aValue,
        (newValue, oldValue, scope) => {
          valueProvided = newValue;
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
      expect(valueProvided).toBe(scope.aValue);

      scope.aValue = 43;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('works like a normal watch for NaNs', () => {
      scope.aValue = 0 / 0;
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.aValue,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('notices when the value becomes an array', () => {
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.arr,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arr = [1, 2, 3];
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('notices an item added to an array', () => {
      scope.arr = [1, 2, 3];
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.arr,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arr.push(4);
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('notices an item removed from an array', () => {
      scope.arr = [1, 2, 3];
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.arr,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arr.shift();
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('notices an item replaced in an array', () => {
      scope.arr = [1, 2, 3];
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.arr,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arr[1] = 42;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('notices an item reordered in an array', () => {
      scope.arr = [2, 1, 3];
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.arr,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arr.sort();
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('does not fail on NaNs in arrays', () => {
      scope.arr = [2, NaN, 3];
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.arr,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('notices an item replaced in an arguments object', () => {
      (() => (scope.arrayLike = arguments))(1, 2, 3);
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.arrayLike,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.arrayLike[1] = 42;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('notices an item replaced in a NodeList object', () => {
      document.documentElement.appendChild(document.createElement('div'));
      scope.arrayLike = document.getElementsByTagName('div');

      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.arrayLike,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      document.documentElement.appendChild(document.createElement('div'));
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('notices when the value becomes an object', () => {
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.object,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.object = { a: 1 };
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('notices when an attribute is added to an object', () => {
      scope.counter = 0;
      scope.object = { a: 1 };

      scope.$watchCollection(
        scope => scope.object,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.object.b = 2;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('notices when an attribute is changed in an object', () => {
      scope.counter = 0;
      scope.object = { a: 1 };

      scope.$watchCollection(
        scope => scope.object,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      scope.object.a = 2;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('does not fail on NaN atributes in objects', () => {
      scope.counter = 0;
      scope.object = { a: NaN };

      scope.$watchCollection(
        scope => scope.object,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);
    });

    it('notices when an attribute is removed from an object', () => {
      scope.counter = 0;
      scope.object = { a: 1 };

      scope.$watchCollection(
        scope => scope.object,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();
      expect(scope.counter).toBe(1);

      delete scope.object.a;
      scope.$digest();
      expect(scope.counter).toBe(2);

      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('does not consider an object with a length property an array', () => {
      scope.object = { length: 42, otherKey: 'abc' };
      scope.counter = 0;

      scope.$watchCollection(
        scope => scope.object,
        (newValue, oldValue, scope) => {
          scope.counter++;
        }
      );

      scope.$digest();

      scope.object.newKey = 'def';
      scope.$digest();
      expect(scope.counter).toBe(2);
    });

    it('gives the old non-collection value to listeners', () => {
      scope.aValue = 42;
      let oldValueGiven;

      scope.$watchCollection(
        scope => scope.aValue,
        (newValue, oldValue, scope) => {
          oldValueGiven = oldValue;
        }
      );

      scope.$digest();

      scope.aValue = 43;
      scope.$digest();

      expect(oldValueGiven).toBe(42);
    });

    it('gives the old array value to listeners', () => {
      scope.arr = [1, 2, 3];
      let oldValueGiven;

      scope.$watchCollection(
        scope => scope.arr,
        (newValue, oldValue, scope) => {
          oldValueGiven = oldValue;
        }
      );

      scope.$digest();

      scope.arr.push(4);
      scope.$digest();

      expect(oldValueGiven).toEqual([1, 2, 3]);
    });

    it('gives the old object value to listeners', () => {
      scope.object = { a: 1, b: 2 };
      let oldValueGiven;

      scope.$watchCollection(
        scope => scope.object,
        (newValue, oldValue, scope) => {
          oldValueGiven = oldValue;
        }
      );

      scope.$digest();

      scope.object.c = 3;
      scope.$digest();

      expect(oldValueGiven).toEqual({ a: 1, b: 2 });
    });

    it('uses the new value as the old value on first digest', () => {
      scope.object = { a: 1, b: 2 };
      let oldValueGiven;

      scope.$watchCollection(
        scope => scope.object,
        (newValue, oldValue, scope) => {
          oldValueGiven = oldValue;
        }
      );

      scope.$digest();

      expect(oldValueGiven).toEqual({ a: 1, b: 2 });
    });
  });

  describe('events', () => {
    let parent, scope, child, isolatedChild;

    beforeEach(() => {
      parent = new Scope();
      scope = parent.$new();
      child = scope.$new();
      isolatedChild = scope.$new(true);
    });

    it('allows registering listeners', () => {
      const listnener1 = () => {};
      const listnener2 = () => {};
      const listnener3 = () => {};

      scope.$on('someEvent', listnener1);
      scope.$on('someEvent', listnener2);
      scope.$on('someOtherEvent', listnener3);

      expect(scope.$$listeners).toEqual({
        someEvent: [listnener1, listnener2],
        someOtherEvent: [listnener3]
      });
    });

    it('registers different listeners for every scope', () => {
      const listnener1 = () => {};
      const listnener2 = () => {};
      const listnener3 = () => {};

      scope.$on('someEvent', listnener1);
      child.$on('someEvent', listnener2);
      isolatedChild.$on('someEvent', listnener3);

      expect(scope.$$listeners).toEqual({ someEvent: [listnener1] });
      expect(child.$$listeners).toEqual({ someEvent: [listnener2] });
      expect(isolatedChild.$$listeners).toEqual({ someEvent: [listnener3] });
    });

    _.forEach(['$emit', '$broadcast'], method => {
      it(`calls listeners registered for matching events on ${method}`, () => {
        const listener1 = jasmine.createSpy();
        const listener2 = jasmine.createSpy();
        scope.$on('someEvent', listener1);
        scope.$on('someOtherEvent', listener2);

        scope[method]('someEvent');

        expect(listener1).toHaveBeenCalled();
        expect(listener2).not.toHaveBeenCalled();
      });

      it(`passes an event object with a name to listeners on ${method}`, () => {
        const listener = jasmine.createSpy();
        scope.$on('someEvent', listener);

        scope[method]('someEvent');

        expect(listener).toHaveBeenCalled();
        expect(listener.calls.mostRecent().args[0].name).toEqual('someEvent');
      });

      it(`passes the same event object to each listener on ${method}`, () => {
        const listener1 = jasmine.createSpy();
        const listener2 = jasmine.createSpy();
        scope.$on('someEvent', listener1);
        scope.$on('someEvent', listener2);

        scope[method]('someEvent');

        const event1 = listener1.calls.mostRecent().args[0];
        const event2 = listener2.calls.mostRecent().args[0];

        expect(event1).toBe(event2);
      });

      it(`passes additional arguments to listeners on ${method}`, () => {
        const listener = jasmine.createSpy();
        scope.$on('someEvent', listener);

        scope[method]('someEvent', 'and', ['additional', 'arguments'], '...');

        expect(listener.calls.mostRecent().args[1]).toEqual('and');
        expect(listener.calls.mostRecent().args[2]).toEqual([
          'additional',
          'arguments'
        ]);
        expect(listener.calls.mostRecent().args[3]).toEqual('...');
      });

      it(`returns the event object on ${method}`, () => {
        const returnedEvent = scope[method]('someEvent');

        expect(returnedEvent).toBeDefined();
        expect(returnedEvent.name).toEqual('someEvent');
      });

      it(`can be deregistered ${method}`, () => {
        const listener = jasmine.createSpy();
        const deregister = scope.$on('someEvent', listener);

        deregister();

        scope[method]('someEvent');

        expect(listener).not.toHaveBeenCalled();
      });

      it(`does not skip the next listener when removed on ${method}`, () => {
        let deregister;

        const listener = () => deregister();
        const nextListener = jasmine.createSpy();

        deregister = scope.$on('someEvent', listener);
        scope.$on('someEvent', nextListener);

        scope[method]('someEvent');

        expect(nextListener).toHaveBeenCalled();
      });

      it(`sets currentScope to null after propagation of ${method}`, () => {
        let event;
        let scopeListener = evt => (event = evt);

        scope.$on('someEvent', scopeListener);

        scope[method]('someEvent');

        expect(event.currentScope).toBe(null);
      });

      it(`sets defaultPrevented when preventDefault called on ${method}`, () => {
        const listener = event => event.preventDefault();
        scope.$on('someEvent', listener);

        const event = scope[method]('someEvent');

        expect(event.defaultPrevented).toBe(true);
      });

      it(`does not stop on exceptions on ${method}`, () => {
        const listener1 = event => {
          throw 'listener1 throwing an exception';
        };
        const listener2 = jasmine.createSpy();

        scope.$on('someEvent', listener1);
        scope.$on('someEvent', listener2);

        scope[method]('someEvent');

        expect(listener2).toHaveBeenCalled();
      });
    });

    it('propagates up the scope hierarchy for $emit', () => {
      const parentListener = jasmine.createSpy();
      const scopeListener = jasmine.createSpy();

      parent.$on('someEvent', parentListener);
      scope.$on('someEvent', scopeListener);

      scope.$emit('someEvent');

      expect(scopeListener).toHaveBeenCalled();
      expect(parentListener).toHaveBeenCalled();
    });

    it('propagates the same event up on $emit', () => {
      const parentListener = jasmine.createSpy();
      const scopeListener = jasmine.createSpy();

      parent.$on('someEvent', parentListener);
      scope.$on('someEvent', scopeListener);

      scope.$emit('someEvent');

      const scopeEvent = scopeListener.calls.mostRecent().args[0];
      const parentEvent = parentListener.calls.mostRecent().args[0];

      expect(scopeEvent).toBe(parentEvent);
    });

    it('propagates down the scope hierarchy for $broadcast', () => {
      const scopeListener = jasmine.createSpy();
      const childListener = jasmine.createSpy();
      const isolatedChildListener = jasmine.createSpy();

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);
      isolatedChild.$on('someEvent', isolatedChildListener);

      scope.$broadcast('someEvent');

      expect(scopeListener).toHaveBeenCalled();
      expect(childListener).toHaveBeenCalled();
      expect(isolatedChildListener).toHaveBeenCalled();
    });

    it('propagates the same event down on $broadcast', () => {
      const scopeListener = jasmine.createSpy();
      const childListener = jasmine.createSpy();

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);

      scope.$broadcast('someEvent');

      const scopeEvent = scopeListener.calls.mostRecent().args[0];
      const childEvent = childListener.calls.mostRecent().args[0];

      expect(scopeEvent).toBe(childEvent);
    });

    it('attaches targetScope on $emit', () => {
      const scopeListener = jasmine.createSpy();
      const parentListener = jasmine.createSpy();

      scope.$on('someEvent', scopeListener);
      parent.$on('someEvent', parentListener);

      scope.$emit('someEvent');

      expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope);
      expect(parentListener.calls.mostRecent().args[0].targetScope).toBe(scope);
    });

    it('attaches targetScope on $broadcast', () => {
      const scopeListener = jasmine.createSpy();
      const childListener = jasmine.createSpy();

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);

      scope.$broadcast('someEvent');

      expect(scopeListener.calls.mostRecent().args[0].targetScope).toBe(scope);
      expect(childListener.calls.mostRecent().args[0].targetScope).toBe(scope);
    });

    it('attaches currentScope on $emit', () => {
      let currentScopeOnScope, currentScopeOnParent;
      const scopeListener = event => (currentScopeOnScope = event.currentScope);
      const parentListener = event =>
        (currentScopeOnParent = event.currentScope);

      scope.$on('someEvent', scopeListener);
      parent.$on('someEvent', parentListener);

      scope.$emit('someEvent');

      expect(currentScopeOnScope).toBe(scope);
      expect(currentScopeOnParent).toBe(parent);
    });

    it('attaches currentScope on $broadcast', () => {
      let currentScopeOnScope, currentScopeOnChild;
      const scopeListener = event => (currentScopeOnScope = event.currentScope);
      const childListener = event => (currentScopeOnChild = event.currentScope);

      scope.$on('someEvent', scopeListener);
      child.$on('someEvent', childListener);

      scope.$broadcast('someEvent');

      expect(currentScopeOnScope).toBe(scope);
      expect(currentScopeOnChild).toBe(child);
    });

    it('does not propagate parents when stopped', () => {
      const scopeListener = event => event.stopPropagation();
      const parentListener = jasmine.createSpy();

      scope.$on('someEvent', scopeListener);
      parent.$on('someEvent', parentListener);

      scope.$emit('someEvent');

      expect(parentListener).not.toHaveBeenCalled();
    });

    it('is received by listeners on current scope after being stopped', () => {
      const listener1 = event => event.stopPropagation();
      const listener2 = jasmine.createSpy();

      scope.$on('someEvent', listener1);
      scope.$on('someEvent', listener2);

      scope.$emit('someEvent');

      expect(listener2).toHaveBeenCalled();
    });

    it('fires $destroy when destroyed', () => {
      const listener = jasmine.createSpy();
      scope.$on('$destroy', listener);

      scope.$destroy();

      expect(listener).toHaveBeenCalled();
    });

    it('fires $destroy on children destroyed', () => {
      const listener = jasmine.createSpy();
      child.$on('$destroy', listener);

      scope.$destroy();

      expect(listener).toHaveBeenCalled();
    });

    it('no longer calls listeners after destroyed', () => {
      const listener = jasmine.createSpy();
      scope.$on('someEvent', listener);

      scope.$destroy();

      scope.$emit('someEvent');
      expect(listener).not.toHaveBeenCalled();
    });
  });
});
