/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as s from '../../src/utils/stream';

describe('Stream.isEmpty', () => {

    test('empty array', () => {
        const stream = s.stream([]);
        expect(stream.isEmpty()).toBe(true);
    });

    test('non-empty array', () => {
        const stream = s.stream([1, 2, 3]);
        expect(stream.isEmpty()).toBe(false);
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

    test('boolean check false', () => {
        type A = { a: number };
        type B = A & { b: number };
        const isB = (value: A): value is B => typeof (value as B).b === 'number';
        const stream: s.Stream<A> = s.stream([{ a: 1, b: 2 }, { a: 3, b: 4 }]);
        if (stream.every(isB)) {
            // This test is about the type inference, so we actually expect the compiler to accept the
            // uncasted access to property `b`.
            expect(stream.filter(v => v.b > 5).toArray()).toHaveLength(0);
        } else {
            fail('Expected every to return true');
        }
    });

});

describe('Stream.map', () => {

    // test('works with an array', () => {
    //     const stream = [1, 2, 3] as s.ArrayLikeStream<number>;
    //     expect(stream.every(value => value)).toBe(true);
    // });

});

describe('Stream.concat', () => {

    test('simple array streams', () => {
        const a = s.stream(['A']);
        const b = s.stream(['B']);
        expect(a.concat(b).toArray()).toMatchObject(['A', 'B']);
    });

    test('nested concatinated streams', () => {
        const a = s.stream(['A']);
        const b = s.stream(['B']);
        const c = s.stream(['C']);
        expect(a.concat(b.concat(c)).toArray()).toMatchObject(['A', 'B', 'C']);
    });

    test('concat multiple streams', () => {
        const a = s.stream(['A']);
        const b = s.stream(['B']);
        const c = s.stream(['C']);
        expect(a.concat(b).concat(c).toArray()).toMatchObject(['A', 'B', 'C']);
    });

    test('empty streams', () => {
        const a = s.EMPTY_STREAM;
        const b = s.EMPTY_STREAM;
        expect(a.concat(b).toArray()).toMatchObject([]);
    });

    test('array stream with empty stream', () => {
        const a = s.EMPTY_STREAM;
        const b = s.stream(['B']);
        expect(a.concat(b).toArray()).toMatchObject(['B']);
    });

});

describe('Stream.distinct', () => {

    test('empty stream returns empty stream', () => {
        expect(s.EMPTY_STREAM.distinct().toArray()).toMatchObject([]);
    });

    test('different items stay the same', () => {
        const stream = s.stream(['A', 'B', 'C']);
        expect(stream.distinct().toArray()).toMatchObject(['A', 'B', 'C']);
    });

    test('different items with different types stay the same', () => {
        const stream = s.stream(['A', 1, true]);
        expect(stream.distinct().toArray()).toMatchObject(['A', 1, true]);
    });

    test('duplicate entries are removed', () => {
        const stream = s.stream(['A', 'A', 'B']);
        expect(stream.distinct().toArray()).toMatchObject(['A', 'B']);
    });

    test('duplicate entries of different types stay the same', () => {
        const stream = s.stream(['1', 1, '2']);
        expect(stream.distinct().toArray()).toMatchObject(['1', 1, '2']);
    });

    test('distinct empty objects stay the same', () => {
        const a = {};
        const b = {};
        const stream = s.stream([a, b]);
        expect(stream.distinct().toArray()).toMatchObject([a, b]);
    });

    test('same objects are removed', () => {
        const a = {};
        const stream = s.stream([a, a]);
        expect(stream.distinct().toArray()).toMatchObject([a]);
    });

    test('distinct objects by value are removed', () => {
        const a = { value: 'A' };
        const b = { value: 'A' };
        const stream = s.stream([a, b]);
        expect(stream.distinct(e => e.value).toArray()).toMatchObject([a]);
    });

    test('distinct objects by value stay the same', () => {
        const a = { value: 'A' };
        const b = { value: 'B' };
        const stream = s.stream([a, b]);
        expect(stream.distinct(e => e.value).toArray()).toMatchObject([a, b]);
    });

});

describe('Stream.join', () => {

    test('empty stream', () => {
        const stream = s.EMPTY_STREAM;
        expect(stream.join()).toBe('');
    });

    test('string stream with default separator', () => {
        const stream = s.stream(['A', 'B']);
        expect(stream.join()).toBe('A,B');
    });

    test('string stream with custom separator', () => {
        const stream = s.stream(['A', 'B']);
        expect(stream.join(' & ')).toBe('A & B');
    });

    test('number stream', () => {
        const stream = s.stream([1, 3]);
        expect(stream.join()).toBe('1,3');
    });

    test('boolean stream', () => {
        const stream = s.stream([1, true]);
        expect(stream.join()).toBe('1,true');
    });

    test('undefined in stream', () => {
        const stream = s.stream([1, undefined]);
        expect(stream.join()).toBe('1,undefined');
    });

    test('mixed number/string stream', () => {
        const stream = s.stream([1, 'A']);
        expect(stream.join()).toBe('1,A');
    });

    test('object stream', () => {
        const stream = s.stream([{}]);
        expect(stream.join()).toBe('[object Object]');
    });

    test('object stream with custom toString method', () => {
        const stream = s.stream([new CustomToString('A'), new CustomToString('B')]);
        expect(stream.join()).toBe('A,B');
    });

    test('object stream without prototype', () => {
        const stream = s.stream([Object.create(null)]);
        expect(stream.join()).toBe('[object Object]');
    });

    class CustomToString {
        // eslint-disable-next-line @typescript-eslint/no-parameter-properties
        constructor(public input: string) {}

        toString(): string {
            return this.input;
        }
    }

});
