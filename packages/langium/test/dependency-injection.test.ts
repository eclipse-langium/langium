/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import { Module, inject } from 'langium';
import { describe, expect, test } from 'vitest';

describe('A dependency type', () => {

    test('should be undefined', () => checkType(undefined));
    test('should be null', () => checkType(null));
    test('should be false', () => checkType(false));
    test('should be true', () => checkType(true));
    test('should be 0', () => checkType(0));
    test('should be 1', () => checkType(1));
    test('should be empty string', () => checkType(''));
    test('should be non empty string', () => checkType('a'));
    test('should be empty array', () => checkType([]));
    test('should be non-empty array', () => checkType([1]));
    test('should be empty object', () => checkType({}));
    test('should be non-empty object', () => checkType({ _: 1 }));
    test('should be class', () => checkType(class { }));
    test('should be class instance', () => checkType(new (class { })()));
    test('should be function', () => checkType(function a() { }));
    test('should be lambda', () => checkType(() => { }));

    function checkType(value: unknown): void {
        const api = inject({ _: () => value });
        expect(typeof api._).toBe(typeof value);
        expect(api._).toBe(value);
    }

});

describe('A non-cyclic dependency', () => {

    test('should be callable', () => {
        expect(
            inject({ dep: () => () => true }).dep()
        ).toBe(true);
    });

    test('should be constructable', () => {
        class A { }
        expect(
            new (inject({ dep: () => A }).dep)()
        ).toBeInstanceOf(A);
    });

    test('should be getable', () => {
        expect(
            inject({ dep: () => ({ a: true }) }).dep.a
        ).toBe(true);
    });

    test('should be result on an idempotent api call', () => {
        const api = inject({ dep: () => ({}) });
        expect(api.dep).toBe(api.dep);
    });

});

describe('A cyclic dependency', () => {

    // this is a requirement for the following tests
    test('should be injected lazily', () => {
        const api = createCycle(undefined);
        expect(api.a).not.toBeUndefined();
        expect(api.b).not.toBeUndefined();
        expect(api.a.b).toBe(api.b);
        expect(api.b.a()).toBe(api.a);
    });

    test('should be result on an idempotent api call', () => {
        const api = createA({});
        expect(api.testee).not.toBeUndefined();
        expect(api.testee).toBe(api.testee);
    });

    test('should be callable', () => {
        expect(
            createA(() => true).testee()
        ).toBe(true);
    });

    test('should be constructable', () => {
        class A { }
        expect(
            new (createA(A).testee)()
        ).toBeInstanceOf(A);
    });

    test('should be getable', () => {
        expect(
            createA({ c: true }).testee.c
        ).toBe(true);
    });

    test('should work with for..in', () => {
        const obj = createA(1);
        const res: string[] = [];
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                res.push(key);
            }
        }
        expect(res).toEqual(['b', 'testee']);
    });

    interface API<T> {
        a: A<T>
        b: B<T>
    }

    class A<T> {
        b: B<T>;
        testee: T;
        constructor(b: B<T>, testee: T) {
            this.b = b;
            this.testee = testee;
        }
    }

    class B<T> {
        a: () => A<T>;
        constructor(api: API<T>) {
            this.a = () => api.a;
        }
    }

    function createCycle<T>(testee: T): API<T> {
        return inject({
            a: ({ b }) => new A(b, testee),
            b: (api) => new B(api)
        });
    }

    function createA<T>(testee: T): A<T> {
        const api = createCycle(testee);
        api.a; // initializes cycle
        return api.b.a();
    }

});

describe('The inject function', () => {

    test('should forward construction error', () => {
        interface API { first: { a: boolean }, second: { b: boolean } }
        const createFirst = () => { throw new Error('construction error'); };
        const createSecond = ({ first }: API) => ({ b: first.a });
        expect(() =>
            inject({ first: createFirst, second: createSecond }).second
        ).toThrowError('construction error');
    });

    test('should properly forward past construction errors when building multiple times', () => {
        //before fixing issue #463 a second attempt was leading to a cycle detection error (wrong direction for debugging people)
        interface API { first: { a: boolean }, second: { b: boolean }, third: { c: boolean } }
        const createFirst = () => { throw new Error('construction error'); };
        const createSecond = ({ first }: API) => ({ b: first.a });
        const createThird = ({ first }: API) => ({ c: first.a });
        const result = inject({ first: createFirst, second: createSecond, third: createThird });
        expect(() =>
            result.second
        ).toThrowError('construction error');
        expect(() =>
            result.second
        ).toThrowError(/Construction failure/); //where cause is Error('construction error')
    });

    test('should work with arrays', () => {
        const api = inject([
            () => true,
            () => 1
        ]);
        expect(api[0]).toBe(true);
        expect(api[1]).toBe(1);
        expect(api[2 as any]).toBeUndefined();
    });

    test('should work with objects', () => {
        const api = inject({
            a: () => true,
            b: () => 1
        });
        expect(api.a).toBe(true);
        expect(api.b).toBe(1);
        expect((api as any).c).toBeUndefined();
    });

    test('should allow cycles in class constructors', () => {
        interface API { a: A, b: B }
        class A {
            b: B;
            constructor({ b }: API) { this.b = b; }
        }
        class B {
            a: () => A;
            constructor(api: API) { this.a = () => api.a; }
        }
        expect(() =>
            inject({ a: (api: API) => new A(api), b: (api: API) => new B(api) }).a
        ).not.toThrow();
    });

    test('should allow cycles in functions', () => {
        type API = { a: A, b: B }
        type A = { b: B }
        type B = { a: () => A }
        const createA = ({ b }: API) => ({ b });
        const createB = (api: API) => ({ a: () => api.a });
        expect(() =>
            inject({ a: createA, b: createB }).a
        ).not.toThrow();
    });

    test('should throw when cyclic dependency is accessed during class construction', () => {
        interface API { a: A, b: B }
        class A {
            a: boolean;
            constructor({ b }: API) { this.a = b.b; }
        }
        class B {
            b: boolean;
            constructor({ a }: API) { this.b = a.a; }
        }
        expect(() =>
            inject({ a: (api: API) => new A(api), b: (api: API) => new B(api) }).a
        ).toThrowError(/Cycle detected. Please make "a" lazy/);
    });

    test('should throw when cyclic dependency is accessed during factory function call', () => {
        interface API { a: { a: boolean }, b: { b: boolean } }
        const createA = ({ b }: API) => ({ a: b.b });
        const createB = ({ a }: API) => ({ b: a.a });
        expect(() =>
            inject({ a: createA, b: createB }).a
        ).toThrowError(/Cycle detected. Please make "a" lazy/);
    });

    test('should merge groups', () => {

        class A {
        }

        class B extends A {
            constructor(a: A) {
                super();
            }
            a = 1;
        }

        interface I1 {
            groupA: {
                service1: A
            }
        }

        interface I2 {
            groupB: {
                groupC: {
                    service2: A
                }
            }
        }

        const m1: Module<I1> = {
            groupA: {
                service1: () => new A()
            }
        };

        const m2: Module<I2> = {
            groupB: {
                groupC: {
                    service2: () => new A()
                }
            }
        };

        const m3 = { // intentionally not declared as Module<I3>
            groupB: {
                groupC: {
                    // injector may have an arbitrary type but
                    // the inject() call will fail for m3 if no module
                    // exists that provides that injector
                    service2: (injector: I1) => new B(injector.groupA.service1)
                }
            },
            x: () => 1
        };

        const xxx = inject(m1, m2, m3);

        const a: A = xxx.groupA.service1; // infers A
        const ab: A & B = xxx.groupB.groupC.service2; // infers A & B
        const x: number = xxx.x; // infers number

        expect(a).toBeInstanceOf(A);
        expect(ab).toBeInstanceOf(B);
        expect(x).toBe(1);
    });

});

describe('The inject result', () => {

    test('should be immutable', () => {
        const api: any = inject({ a: () => 1 });
        expect(() => delete api.a).toThrowError('\'deleteProperty\' on proxy: trap returned falsish for property \'a\'');
        expect(api.a).toBe(1);
    });

    test('should work with for..in', () => {
        const obj = inject({ a: () => 1, b: () => 2 });
        const res: string[] = [];
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                res.push(key);
            }
        }
        expect(res).toEqual(['a', 'b']);
    });

    test('should throw error when used with for..of', () => {
        const obj = inject([() => 1, () => 'a']);
        expect(() => {
            for (const _ of obj) {
                // We expect an error here
            }
        }).toThrowError();
    });

    test('should work with ..in.. for array', () => {
        const obj = inject([() => 1]);
        expect(0 in obj).toBe(true);
        expect(1 in obj).toBe(false);
        expect(obj[0]).toBe(1);
    });

    test('should work with ..in.. for object', () => {
        const obj = inject({ a: () => 1 });
        expect('a' in obj).toBe(true);
        expect('b' in obj).toBe(false);
    });

    test('should not be extensible', () => {
        const obj: any = inject({});
        expect(() => (obj.a = 1)).toThrowError('Cannot set property on injected service container');
    });

});

describe('The Module.merge function', () => {

    const moduleA: Module<{ a: unknown, b: unknown }> = Object.freeze({ a: () => 1,       b: () => ({ b: 2 }) });
    const moduleB: Module<{ c: unknown, d: unknown }> = Object.freeze({ c: () => () => 3, d: () => [ 4, 5]    });

    // Recall the contract: 'moduleA' and 'moduleB' shall stay unchanged during the merge, which is enforced by them being frozen.

    test('Merge two flat modules', () => {
        const merged = Module.merge(moduleA, moduleB);

        expect(merged).toEqual({
            ...moduleA,
            ...moduleB,
        });

        // 'merged' is supposed to be a new object, different from moduleA and moduleB
        expect(merged).not.toBe(moduleA);
        expect(merged).not.toBe(moduleB);
    });

    test('Merge two nested modules with different parent keys', () => {
        type NestedModule = {
            subModuleA: typeof moduleA,
            subModuleB: typeof moduleB
        }

        const m1: Partial<NestedModule> = { subModuleA: moduleA };
        const m2: Partial<NestedModule> = { subModuleB: moduleB };

        const merged = Module.merge(m1, m2);

        expect(merged).toEqual({
            subModuleA: moduleA,
            subModuleB: moduleB
        });

        // 'merged.subModuleA' and 'merged.subModuleB' are supposed to be new objects, different from moduleA and moduleB
        expect(merged.subModuleA).not.toBe(moduleA);
        expect(merged.subModuleB).not.toBe(moduleB);
    });

    test('Merge two nested modules with equal parent keys and different child keys', () => {
        type NestedModule = {
            subModule: Partial<typeof moduleA & typeof moduleB>,
        }

        const m1: Partial<NestedModule> = { subModule: moduleA };
        const m2: Partial<NestedModule> = { subModule: moduleB };

        const merged = Module.merge(m1, m2);

        expect(merged).toEqual({
            subModule: {
                ...moduleA,
                ...moduleB
            }
        });

        // 'merged.subModule' is supposed to be a new object, different from moduleA and moduleB
        expect(merged.subModule).not.toBe(moduleA);
        expect(merged.subModule).not.toBe(moduleB);

        // besides, 'moduleA' and 'moduleB' shall stay unchanged during the merge,
        //   which is enforced by them being frozen;
    });

    test('Merge two nested modules with equal parent keys and equal child keys', () => {
        type NestedModule = {
            subModule: Partial<typeof moduleA>,
        }

        const m1: Partial<NestedModule> = { subModule: moduleA };
        const m2: Partial<NestedModule> = { subModule: Object.freeze({ a: moduleB.c, b: moduleB.d}) };

        const merged = Module.merge(m1, m2);

        expect(merged).toEqual({
            subModule: {
                a: moduleB.c,
                b: moduleB.d
            }
        });

        // 'merged.subModule' is supposed to be a new object, different from moduleA and m2.subModule
        expect(merged.subModule).not.toBe(moduleA);
        expect(merged.subModule).not.toBe(m2.subModule);

        // besides, 'moduleA' and 'm2.subModule' shall stay unchanged during the merge,
        //   which is enforced by them being frozen;
    });
});
