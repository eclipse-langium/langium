/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

// -- public types

export type Module<I = Services, G = I> = {
    [K in keyof G]: ServiceFactory<I, G[K]> | Module<I, G[K]>
}

export type Services = Record<number | string | symbol, unknown>

export type ServiceFactory<I, S> = (injector: I) => S

export type Inject<M> = ValidateModules<M, Merge<InferInjectors<M>>, Merge<Containers<M>>>;

// -- internal utility types

type ValidateModules<M, I, C> = C; // TODO(@@dd): take M, I and C into account

type Containers<M> =
    M extends [infer HEAD, ...infer TAIL]
        ? HEAD extends Module<any, infer G> ? [G, ...Containers<TAIL>] : never
        : [];

type InferInjectors<M> =
    M extends [infer H, ...infer T]
        ? [...FunctionArgs<Tuple<H[keyof H]>>, ...InferInjectors<Tuple<H[keyof H]>>, ...InferInjectors<T>]
        : [];

type FunctionArgs<V extends unknown[]> =
    V extends [infer H, ...infer T]
        ? H extends (...args: infer A) => unknown
            ? A extends []
                ? never
                : [A[0], ...FunctionArgs<T>] // we consider only the first argument (the injector), the rest is ignored
            : FunctionArgs<T> // if the head H is no function, check the tail T of the tuple
        : [];

// Tuple<A | B | C> = [A, B, C]
type Tuple<U> = Join<U extends any ? () => U : never> extends () => infer E
    ? [...Tuple<Exclude<U, E>>, E]
    : [];

// Join<A | B | C> = A & B & C, see https://fettblog.eu/typescript-union-to-intersection/
type Join<U> = (U extends any ? (_: U) => 0 : never) extends (_: infer I) => 0
    ? I
    : never;

type Merge<A extends unknown[]> = A extends [infer H, ...infer T]
    ? H extends undefined | null | boolean | number | string | unknown[] | Function
        ? Merge<T>
        : T extends []
            ? H
            : Patch<H, Merge<T>>
    : {}

type Patch<T1, T2> =
    T1 extends undefined | null | boolean | number | string | unknown[] ? T1 & T2 :
    T2 extends undefined | null | boolean | number | string | unknown[] ? never :
    T1 extends Function ? (T2 extends T1 ? T2 : never) : // TODO(@@dd): deep extends for functions (-> compare result + args pairwise)
    T2 extends Function ? never : {
        [K in keyof T1 | keyof T2]:
            K extends keyof T1 & keyof T2 ? Patch<T1[K], T2[K]> :
            K extends keyof T1 ? T1[K] :
            K extends keyof T2 ? T2[K] : never
    }

// -- API

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
export function inject<M extends Module[]>(...modules: M): Inject<M> {
    const module = modules.reduce(_merge, {}) as Inject<M>;
    return _inject(module);
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
