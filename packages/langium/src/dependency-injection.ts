/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

// ===============
// =   EXAMPLE   =
// ===============

{
    // -- TEST -->
    class A { a = "" } // a class represents both, an object and a function
    class B { b = "" }
    const m1: Module<{g1: A, g2: B}> = {
        g1: (injector) => new A()
    }
    const m2 = {
        g2: (injector: {g2: B}) => new B()
    }
    const c = inject(m1, m2);
    const aa: A = c.g1; // TODO(@@dd): BUG: actual: never, expected: A
    const bb: B = c.g2;
    console.log(c);

    type Z = Inject<[typeof m1, typeof m2]>;
    console.log(null as any as Z);
    // <-- TEST --
}
{
    // -- TEST -->
    class A { a = "" } // a class represents both, an object and a function
    class B extends A { b = "" }
    const m1 = {
        x: (i: {a: {b : true }}) => 1,
        xx: (i: {a: { b: false}}) => 1,
        y: {
            g: (i: {b: 1}) => new A()
        }
    }
    const m2 = {
        y: {
            g: (i: {c: ''}) => new B()
        },
        z: (i: {z: 'zzz'}) => ''
    }
    // [
    //   {
    //     a: { b: never /* true & false */ }
    //     b: number
    //     c: string
    //     z: string
    //   },
    //   {
    //     x: number
    //     xx: number
    //     y: {
    //       g: { // A & B
    //         a: string
    //         b: string
    //       }
    //     }
    //     z: string
    //   }
    //]
    const i = inject(m1, m2);
    console.log(i);
    const s1: string = i.y.g.a;
    const s2: string = i.y.g.b;
    type Z<M> = _FunctionArgs<_Tuple<M[keyof M]>>;
    let z: Z<typeof m1> = null as any;
    console.log(z as any);
    type Test = _Merge<_InferInjectors<[typeof m1, typeof m2]>>
    console.log(null as any as Test);
    // type MergeX<M extends unknown[]> = M[number];
    // type TestX = _Merge<[{f: () => A}, {f: () => B}]>;
    // <-- TEST --
}

// TODO(@@dd): the validity of the resulting container G is checked in the return type of inject
export type Module<I, G = Services> = {
    [K in keyof G]: ServiceFactory<I, G[K]> | Module<I, G[K]>
};

export type Services = Record<number | string | symbol, unknown>;

export type ServiceFactory<I, S> = (injector: I) => S;

export type Inject<M extends Module<Services>[]> = _ValidateModules<M>;

// TODO(@@dd): use _InferInjector<M> and check if the injector matches the expected type for every module
type _ValidateModules<M extends Module<Services>[]> = _InferContainer<_Merge<M>>/*
    _Merge<_InferInjectors<M>> extends infer R
        ? R extends any
            ? _Merge<_Containers<M>>
            : never
        : never*/;

type _InferContainer<M extends Module<Services>> = {
    [K in keyof M]:
        M[K] extends (...args: any[]) => infer R ? R : // `R extends unknown ? never : R` does not work
        M[K] extends Module<Services> ? _InferContainer<M[K]> : never
}

type _InferInjector<M extends Module<Services>[]> = _Merge<_InferInjectors<M>>;

type _InferInjectors<M extends unknown[]> =
    M extends [infer H, ...infer T]
        ? [..._FunctionArgs<_Tuple<H[keyof H]>>, ..._InferInjectors<_Tuple<H[keyof H]>>, ..._InferInjectors<T>]
        : [];

type _FunctionArgs<V extends unknown[]> =
    V extends [infer H, ...infer T]
        ? H extends (...args: infer A) => unknown
            ? A extends []
                ? []
                : [A[0], ..._FunctionArgs<T>] // we consider only the first argument (the injector), the rest is ignored
            : _FunctionArgs<T> // if the head H is no function, check the tail T of the tuple
        : [];

// Tuple<A | B | C> = [A, B, C]
type _Tuple<U> = _Join<U extends any ? () => U : never> extends () => infer E
    ? [..._Tuple<Exclude<U, E>>, E]
    : [];

// Join<A | B | C> = A & B & C, see https://fettblog.eu/typescript-union-to-intersection/
type _Join<U> = (U extends any ? (_: U) => 0 : never) extends (_: infer I) => 0
    ? I
    : never;

type _Merge<A extends unknown[]> = A extends [infer H, ...infer T]
    ? H extends undefined | null | boolean | number | string | unknown[] // | Function
        ? _Merge<T>
        : T extends []
            ? H
            : _Patch<H, _Merge<T>>
    : {}

type _Patch<T1, T2> =
    T1 extends undefined | null | boolean | number | string | unknown[] ? T1 & T2 :
    T2 extends undefined | null | boolean | number | string | unknown[] ? never :
    T1 extends Function ? _PatchFunction<T1, T2> :
    T2 extends Function ? never : {
        [K in keyof T1 | keyof T2]:
            K extends keyof T1 & keyof T2 ? _Patch<T1[K], T2[K]> :
            K extends keyof T1 ? T1[K] :
            K extends keyof T2 ? T2[K] : never
    };

type _PatchFunction<F1, F2> =
    F1 extends (...args: infer A1) => infer R1 ?
    F2 extends (...args: infer A2) => infer R2 ?
    R1 extends Function ? (...args: A2) => _PatchFunction<R1, R2> :
    R2 extends Function ? never :
    R2 extends R1 ? (...args: A2) => R2 : never : never : never;

/**
 * Given a sequence of modules, the inject function returns a lazily evaluted
 * dependency injection container that injects dependencies into the requested
 * service when it is requested the first time. Subsequent requests will return
 * the same service.
 *
 * In the case of cyclic dependencies, an Error will be thrown. This can be
 * fixed by injecting a provider `() => T` instead of a `T`.
 *
 * @param modules a list of modules (possibly empty)
 * @returns a runtime container that provides types according to the given modules
 */
export function inject<M extends Module<Services>[]>(...modules: M): Inject<M> {
    const module = modules.reduce(_merge, {}) as Inject<M>;
    return _inject(module); // TODO(@@dd): follow the types, the might be s.th. wrong in _InferContainer<M>
}

/**
 * Helper function that returns an injector by creating a proxy.
 * Invariant: injector is of type I. If injector is undefined, then T = I.
 */
function _inject<I extends Services, T extends Services>(module: Module<I, T>, injector?: any): T {
    const proxy: T = new Proxy({} as any, {
        deleteProperty: () => false,
        get: (obj, prop) => _resolve(obj, prop, module, injector || proxy),
        getOwnPropertyDescriptor: (obj, prop) => (_resolve(obj, prop, module, injector || proxy), Object.getOwnPropertyDescriptor(obj, prop)), // used by for..in
        has: (_, prop) => prop in module, // used by ..in..
        ownKeys: () => Reflect.ownKeys(module) // used by for..in
    });
    return proxy;
}

/**
 * Internally used to tag a requested dependency, directly before calling the factory.
 * This allows us to find cycles during instance creation.
 */
const __requested__ = Symbol();

/**
 * Returns the value `obj[prop]`. If the value does not exist, yet, it is resolved from
 * the module description. The result of service factories is cached. Groups are
 * recursively proxied.
 *
 * @param obj an object holding all group proxies and services
 * @param prop the key of a value within obj
 * @param module an object containing groups and service factories
 * @param injector the first level proxy that provides access to all values
 * @returns the requested value `obj[prop]`
 * @throws Error if a dependency cycle is detected
 */
function _resolve<I extends Services, T extends Services>(obj: any, prop: string | symbol | number, module: Module<I, T>, injector: I): T[keyof T] | undefined {
    if (prop in obj) {
        if (obj[prop] === __requested__) {
            throw new Error('Cycle detected. Please make "' + String(prop) + '" lazy. See https://langium.org/docs/di/cyclic-dependencies');
        }
        return obj[prop];
    } else if (prop in module) {
        const value = module[prop as keyof T];
        obj[prop] = __requested__;
        obj[prop] = (typeof value === 'function') ? value(injector) : _inject(value, injector); // TODO(@@dd): allow to direcly construct classes using new
        return obj[prop];
    } else {
        return undefined;
    }
}

/**
 * Performs a deep-merge of two modules by writing source entries into the target module.
 *
 * @param target the module which is written
 * @param source the module which is read
 * @returns the target module
 */
function _merge(target: Module<any>, source?: Module<any>): Module<Services> {
    if (source) {
        for (const [key, value2] of Object.entries(source)) {
            if (value2 !== undefined) {
                const value1 = target[key];
                if (value1 !== null && value2 !== null && typeof value1 === 'object' && typeof value2 === 'object') {
                    target[key] = _merge(value1, value2);
                } else {
                    target[key] = value2;
                }
            }
        }
    }
    return target;
}
