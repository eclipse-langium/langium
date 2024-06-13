/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, onTestFailed, test } from 'vitest';
import * as s from 'langium';

describe('stream', () => {

    test('from Set', () => {
        const stream = s.stream(new Set([1, 2, 3]));
        expect(stream.toArray()).toEqual([1, 2, 3]);
    });

    test('from Map', () => {
        const stream = s.stream(new Map([['a', 1], ['b', 2], ['c', 3]]));
        expect(stream.toArray()).toEqual([['a', 1], ['b', 2], ['c', 3]]);
    });

    test('from array-like', () => {
        const stream = s.stream({ length: 3, 0: 'a', 1: 'b', 2: 'c' });
        expect(stream.toArray()).toEqual(['a', 'b', 'c']);
    });

    test('from multiple collections', () => {
        const stream = s.stream<number | string>(
            new Set([1, 2, 3]),
            [],
            { length: 3, 0: 'a', 1: 'b', 2: 'c' },
            [],
            ['foo', 123]
        );
        expect(stream.toArray()).toEqual([1, 2, 3, 'a', 'b', 'c', 'foo', 123]);
    });

});

describe('Stream.isEmpty', () => {

    test('empty stream', () => {
        const stream = s.EMPTY_STREAM;
        expect(stream.isEmpty()).toBe(true);
    });

    test('non-empty stream', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.isEmpty()).toBe(false);
    });

});

describe('Stream.count', () => {

    test('empty array', () => {
        const stream = s.EMPTY_STREAM;
        expect(stream.count()).toBe(0);
    });

    test('non-empty array', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.count()).toBe(3);
    });

});

describe('Stream.toSet', () => {

    test('empty stream', () => {
        const stream = s.EMPTY_STREAM;
        expect(stream.toSet()).toEqual(new Set());
    });

    test('non-empty array', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.toSet()).toEqual(new Set([1, 2, 3]));
    });

});

describe('Stream.toMap', () => {

    test('empty stream', () => {
        const stream = s.EMPTY_STREAM;
        expect(stream.toMap()).toEqual(new Map());
    });

    test('key and value unmapped', () => {
        const stream = s.stream([{ a: 1, b: 'foo' }, { a: 2, b: 'bar' }, { a: 3, b: 'baz' }]);
        expect(stream.toMap()).toEqual(new Map([
            [{ a: 1, b: 'foo' }, { a: 1, b: 'foo' }],
            [{ a: 2, b: 'bar' }, { a: 2, b: 'bar' }],
            [{ a: 3, b: 'baz' }, { a: 3, b: 'baz' }]
        ]));
    });

    test('key mapped', () => {
        const stream = s.stream([{ a: 1, b: 'foo' }, { a: 2, b: 'bar' }, { a: 3, b: 'baz' }]);
        expect(stream.toMap(e => e.b)).toEqual(new Map([
            ['foo', { a: 1, b: 'foo' }],
            ['bar', { a: 2, b: 'bar' }],
            ['baz', { a: 3, b: 'baz' }]
        ]));
    });

    test('value mapped', () => {
        const stream = s.stream([{ a: 1, b: 'foo' }, { a: 2, b: 'bar' }, { a: 3, b: 'baz' }]);
        expect(stream.toMap(undefined, e => e.a)).toEqual(new Map([
            [{ a: 1, b: 'foo' }, 1],
            [{ a: 2, b: 'bar' }, 2],
            [{ a: 3, b: 'baz' }, 3]
        ]));
    });

    test('key and value mapped', () => {
        const stream = s.stream([{ a: 1, b: 'foo' }, { a: 2, b: 'bar' }, { a: 3, b: 'baz' }]);
        expect(stream.toMap(e => e.b, e => e.a)).toEqual(new Map([
            ['foo', 1],
            ['bar', 2],
            ['baz', 3]
        ]));
    });

});

describe('Stream.concat', () => {

    test('multiple arrays', () => {
        const a = s.stream(['a']);
        const b = s.stream(['b']);
        const c = s.stream(['c']);
        expect(a.concat(b).concat(c).toArray()).toEqual(['a', 'b', 'c']);
    });

    test('idempotency', () => {
        const a = s.stream(['a']);
        const b = s.stream(['b']);
        const c = a.concat(b);
        expect(c.toArray()).toEqual(['a', 'b']);
        expect(c.toArray()).toEqual(['a', 'b']);
    });

    test('nested concatenation', () => {
        const a = s.stream(['a']);
        const b = s.stream(['b']);
        const c = s.stream(['c']);
        expect(a.concat(b.concat(c)).toArray()).toEqual(['a', 'b', 'c']);
    });

    test('empty streams', () => {
        const a = s.EMPTY_STREAM;
        const b = s.EMPTY_STREAM;
        expect(a.concat(b).toArray()).toEqual([]);
    });

    test('empty stream and array', () => {
        const a = s.EMPTY_STREAM;
        const b = s.stream(['b']);
        expect(a.concat(b).toArray()).toEqual(['b']);
    });

});

describe('Stream.join', () => {

    test('empty stream', () => {
        const stream = s.EMPTY_STREAM;
        expect(stream.join()).toBe('');
    });

    test('string stream with default separator', () => {
        const stream = s.stream(['a', 'b']);
        expect(stream.join()).toBe('a,b');
    });

    test('string stream with custom separator', () => {
        const stream = s.stream(['a', 'b']);
        expect(stream.join(' & ')).toBe('a & b');
    });

    test('mixed type stream', () => {
        const stream = s.stream([1, 'a', true, undefined]);
        expect(stream.join()).toBe('1,a,true,undefined');
    });

    test('object stream', () => {
        const stream = s.stream([{}]);
        expect(stream.join()).toBe('[object Object]');
    });

    test('object stream with custom toString method', () => {
        const stream = s.stream([customToString('a'), customToString('b')]);
        expect(stream.join()).toBe('a,b');
    });

    test('object stream without prototype', () => {
        const stream = s.stream([Object.create(null)]);
        expect(stream.join()).toBe('[object Object]');
    });

    function customToString(input: string) {
        return {
            toString(): string {
                return input;
            }
        };
    }

});

describe('Stream.indexOf', () => {

    test('number stream present', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.indexOf(2)).toBe(1);
    });

    test('number stream absent', () => {
        const stream = s.stream([1, 3]);
        expect(stream.indexOf(2)).toBe(-1);
    });

    test('object stream present', () => {
        const a = { 'a': 1 };
        const b = { 'b': 2 };
        const c = { 'c': 3 };
        const stream = s.stream([a, b, c]);
        expect(stream.indexOf(b)).toBe(1);
    });

    test('object stream not equal', () => {
        const a = { 'a': 1 };
        const b = { 'b': 2 };
        const c = { 'c': 3 };
        const stream = s.stream([a, b, c]);
        expect(stream.indexOf({ 'b': 2 })).toBe(-1);
    });

});

describe('Stream.every', () => {

    test('boolean check true', () => {
        const stream = s.stream([true, true, true]);
        expect(stream.every(value => value)).toBe(true);
    });

    test('boolean check false', () => {
        const stream = s.stream([true, false, true]);
        expect(stream.every(value => value)).toBe(false);
    });

    test('type inference', () => {
        type A = { a: number };
        type B = A & { b: number };
        const isB = (value: A): value is B => typeof (value as B).b === 'number';
        const stream: s.Stream<A> = s.stream([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
        if (stream.every(isB)) {
            // This test is about the type inference, so we actually expect the compiler to accept the
            // uncasted access to property `b`.
            expect(stream.filter(v => v.b > 5).toArray()).toHaveLength(0);
        } else {
            onTestFailed(result => {
                return Promise.reject(new Error(`Expected every to return true: ${result}`));
            });
        }
    });

});

describe('Stream.some', () => {

    test('boolean check true', () => {
        const stream = s.stream([false, true, false]);
        expect(stream.some(value => value)).toBe(true);
    });

    test('boolean check false', () => {
        const stream = s.stream([false, false, false]);
        expect(stream.some(value => value)).toBe(false);
    });

});

describe('Stream.forEach', () => {

    test('sum numbers', () => {
        const stream = s.stream([2, 4, 6]);
        let sumValue = 0;
        let sumIndex = 0;
        stream.forEach((value, index) => {
            sumValue += value;
            sumIndex += index;
        });
        expect(sumValue).toBe(12);
        expect(sumIndex).toBe(3);
    });

});

describe('Stream.map', () => {

    test('shift numbers', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.map(value => value + 1).toArray()).toEqual([2, 3, 4]);
    });

});

describe('Stream.filter', () => {

    test('compare numbers', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.filter(value => value >= 2).toArray()).toEqual([2, 3]);
    });

    test('type inference', () => {
        type A = { a: number };
        type B = A & { b: number };
        const isB = (value: A): value is B => typeof (value as B).b === 'number';
        const stream: s.Stream<A> = s.stream([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
        // This test is about the type inference, so we actually expect the compiler to accept the
        // uncasted access to property `b`.
        expect(stream.filter(isB).find(v => v.b > 5)).toBe(undefined);
    });

});

describe('Stream.reduce', () => {

    test('empty array', () => {
        const stream: s.Stream<number> = s.EMPTY_STREAM;
        expect(stream.reduce((a, b) => a + b)).toBe(undefined);
    });

    test('empty array with initial value', () => {
        const stream: s.Stream<number> = s.EMPTY_STREAM;
        expect(stream.reduce((a, b) => a + b, 0)).toBe(0);
    });

    test('sum numbers', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.reduce((a, b) => a + b)).toBe(6);
    });

    test('compose array', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.reduce<number[]>((array, value) => array.concat([value]), [])).toEqual([1, 2, 3]);
    });

});

describe('Stream.reduceRight', () => {

    test('empty array', () => {
        const stream: s.Stream<number> = s.EMPTY_STREAM;
        expect(stream.reduceRight((a, b) => a + b)).toBe(undefined);
    });

    test('empty array with initial value', () => {
        const stream: s.Stream<number> = s.EMPTY_STREAM;
        expect(stream.reduceRight((a, b) => a + b, 0)).toBe(0);
    });

    test('sum numbers', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.reduceRight((a, b) => a + b)).toBe(6);
    });

    test('compose array', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.reduceRight<number[]>((array, value) => array.concat([value]), [])).toEqual([3, 2, 1]);
    });

});

describe('Stream.find', () => {

    test('number stream present', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.find(value => value > 2)).toBe(3);
    });

    test('number stream absent', () => {
        const stream = s.stream([1, 1.5, 2]);
        expect(stream.find(value => value > 2)).toBe(undefined);
    });

    test('type inference', () => {
        type A = { a: number };
        type B = A & { b: number };
        const isB = (value: A): value is B => typeof (value as B).b === 'number';
        const stream: s.Stream<A> = s.stream([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
        // This test is about the type inference, so we actually expect the compiler to accept the
        // uncasted access to property `b`.
        expect(stream.find(isB)?.b).toBe(2);
    });

});

describe('Stream.findIndex', () => {

    test('number stream present', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.findIndex(value => value > 2)).toBe(2);
    });

    test('number stream absent', () => {
        const stream = s.stream([1, 1.5, 2]);
        expect(stream.findIndex(value => value > 2)).toBe(-1);
    });

});

describe('Stream.includes', () => {

    test('number stream present', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.includes(2)).toBe(true);
    });

    test('number stream absent', () => {
        const stream = s.stream([1, 3]);
        expect(stream.includes(2)).toBe(false);
    });

    test('object stream present', () => {
        const a = { 'a': 1 };
        const b = { 'b': 2 };
        const c = { 'c': 3 };
        const stream = s.stream([a, b, c]);
        expect(stream.includes(b)).toBe(true);
    });

    test('object stream not equal', () => {
        const a = { 'a': 1 };
        const b = { 'b': 2 };
        const c = { 'c': 3 };
        const stream = s.stream([a, b, c]);
        expect(stream.includes({ 'b': 2 })).toBe(false);
    });

});

describe('Stream.flatMap', () => {

    test('number stream', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.flatMap(value => [value]).toArray()).toEqual([1, 2, 3]);
    });

    test('mixed number / array property', () => {
        const stream = s.stream([{ p: [1, 2] }, { p: 3 }, { p: [4, 5] }]);
        expect(stream.flatMap(o => o.p).toArray()).toEqual([1, 2, 3, 4, 5]);
    });

});

describe('Stream.flat', () => {

    test('correct type with arrays', () => {
        const stream = s.stream([[1, 2], [[3, 4]]]);
        const flattened: s.Stream<number> = stream.flat(2);
        expect(flattened.toArray()).toEqual([1, 2, 3, 4]);
    });

    test('correct type with streams', () => {
        const stream = s.stream([s.stream([1, 2]), s.stream([s.stream([3, 4])])]);
        const flattened: s.Stream<number> = stream.flat(2);
        expect(flattened.toArray()).toEqual([1, 2, 3, 4]);
    });

    test('one level', () => {
        const stream = s.stream([1, [2, [3, [4, [5]]]]]);
        expect(stream.flat().toArray()).toEqual([1, 2, [3, [4, [5]]]]);
    });

    test('three levels', () => {
        const stream = s.stream([1, [2, [3, [4, [5]]]]]);
        expect(stream.flat(3).toArray()).toEqual([1, 2, 3, 4, [5]]);
    });

});

describe('Stream.head', () => {

    test('empty stream', () => {
        const stream = s.EMPTY_STREAM;
        expect(stream.head()).toBe(undefined);
    });

    test('number stream', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.head()).toBe(1);
    });

});

describe('Stream.tail', () => {

    test('empty stream', () => {
        const stream = s.EMPTY_STREAM;
        expect(stream.tail().toArray()).toEqual([]);
    });

    test('number stream', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.tail().toArray()).toEqual([2, 3]);
    });

    test('skip three elements', () => {
        const stream = s.stream([1, 2, 3, 4, 5]);
        expect(stream.tail(3).toArray()).toEqual([4, 5]);
    });

});

describe('Stream.limit', () => {

    test('size zero', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.limit(0).toArray()).toEqual([]);
    });

    test('size three', () => {
        const stream = s.stream([1, 2, 3, 4, 5]);
        expect(stream.limit(3).toArray()).toEqual([1, 2, 3]);
    });

});

describe('Stream.distinct', () => {

    test('empty stream', () => {
        const stream = s.EMPTY_STREAM;
        expect(stream.distinct().toArray()).toEqual([]);
    });

    test('different items stay the same', () => {
        const stream = s.stream(['a', 'b', 'c']);
        expect(stream.distinct().toArray()).toEqual(['a', 'b', 'c']);
    });

    test('idempotency', () => {
        const stream = s.stream(['a', 'b', 'c']);
        const distinct = stream.distinct();
        expect(distinct.toArray()).toEqual(['a', 'b', 'c']);
        expect(distinct.toArray()).toEqual(['a', 'b', 'c']);
    });

    test('different items with different types stay the same', () => {
        const stream = s.stream(['a', 1, true]);
        expect(stream.distinct().toArray()).toEqual(['a', 1, true]);
    });

    test('duplicate entries are removed', () => {
        const stream = s.stream(['a', 'a', 'b']);
        expect(stream.distinct().toArray()).toEqual(['a', 'b']);
    });

    test('duplicate entries of different types stay the same', () => {
        const stream = s.stream(['1', 1, '2']);
        expect(stream.distinct().toArray()).toEqual(['1', 1, '2']);
    });

    test('distinct empty objects stay the same', () => {
        const a = {};
        const b = {};
        const stream = s.stream([a, b]);
        expect(stream.distinct().toArray()).toEqual([a, b]);
    });

    test('same objects are removed', () => {
        const a = {};
        const stream = s.stream([a, a]);
        expect(stream.distinct().toArray()).toEqual([a]);
    });

    test('distinct objects by value are removed', () => {
        const a = { value: 'a' };
        const b = { value: 'a' };
        const stream = s.stream([a, b]);
        expect(stream.distinct(e => e.value).toArray()).toEqual([a]);
    });

    test('distinct objects by value stay the same', () => {
        const a = { value: 'a' };
        const b = { value: 'b' };
        const stream = s.stream([a, b]);
        expect(stream.distinct(e => e.value).toArray()).toEqual([a, b]);
    });

});

describe('Stream.exclude', () => {

    test('empty stream', () => {
        const stream = s.EMPTY_STREAM;
        expect(stream.exclude(['A', 'B']).toArray()).toEqual([]);
    });

    test('should exclude overlapping string values', () => {
        const a = s.stream(['a', 'b']);
        const b = s.stream(['b', 'c']);
        expect(a.exclude(b).toArray()).toEqual(['a']);
    });

    test('idempotency', () => {
        const a = s.stream(['a', 'b']);
        const b = s.stream(['b', 'c']);
        const excluded = a.exclude(b);
        expect(excluded.toArray()).toEqual(['a']);
        expect(excluded.toArray()).toEqual(['a']);
    });

    test('should not change on non-overlapping values', () => {
        const a = s.stream(['a', 'b']);
        const b = s.stream(['c', 'd']);
        expect(a.exclude(b).toArray()).toEqual(['a', 'b']);
    });

    test('should exclude overlapping objects by key', () => {
        const a = s.stream([{ value: 'a' }, { value: 'b' }]);
        const b = s.stream([{ value: 'b' }, { value: 'c' }]);
        expect(a.exclude(b, e => e.value).toArray()).toEqual([{ value: 'a' }]);
    });

});

describe('Signature overloads of instances of StreamImpl/TreeStreamImpl', () => {

    type Tree<T> = T | NonLeaf<T>;
    type NonLeaf<T> = T & { children: Array<Tree<T>> };

    const isNonLeaf = (value: object): value is NonLeaf<object> => 'children' in value;
    const getStream = () => new s.TreeStreamImpl<Tree<object>>(
        { children: []},
        p => isNonLeaf(p) && p.children || [],
        { includeRoot: true }
    );

    test('StreamImpl.every', () => {
        // This test is about the type inference, so we actually expect the compiler to accept the uncasted access to property `children`.
        const stream = getStream();
        expect(
            stream.every(isNonLeaf) && stream.flatMap(e => e.children).isEmpty()
        ).toBe(true);
    });

    test('StreamImpl.filter', () => {
        // This test is about the type inference, so we actually expect the compiler to accept the uncasted access to property `children`.
        expect(
            getStream().filter(isNonLeaf).head()?.children
        ).toBeDefined();
    });

    test('StreamImpl.find', () => {
        // This test is about the type inference, so we actually expect the compiler to accept the uncasted access to property `children`.
        expect(
            getStream().find(isNonLeaf)?.children
        ).toBeDefined();
    });

    test('StreamImpl.reduce', () => {
        // This test is about the type inference, so we actually expect the compiler to accept the uncasted access to property `children`.
        expect(
            getStream().reduce(
                (prev, curr) => prev || isNonLeaf(curr) && curr || prev,
                undefined as NonLeaf<object> | undefined
            )?.children
        ).toBeDefined();
    });

    test('StreamImpl.reduceRight', () => {
        // This test is about the type inference, so we actually expect the compiler to accept the uncasted access to property `children`.
        expect(
            getStream().reduceRight(
                (prev, curr) => prev || isNonLeaf(curr) && curr || prev,
                undefined as NonLeaf<object> | undefined
            )?.children
        ).toBeDefined();
    });
});
