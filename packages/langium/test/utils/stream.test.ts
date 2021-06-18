/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as s from '../../src/utils/stream';

describe('concat', () => {

    test('simple array streams', () => {
        const a = s.stream(['A']);
        const b = s.stream(['B']);
        expect(s.toArray(a.concat(b))).toMatchObject(['A', 'B']);
    });

    test('nested concatinated streams', () => {
        const a = s.stream(['A']);
        const b = s.stream(['B']);
        const c = s.stream(['C']);
        expect(s.toArray(a.concat(b.concat(c)))).toMatchObject(['A', 'B', 'C']);
    });

    test('concat multiple streams', () => {
        const a = s.stream(['A']);
        const b = s.stream(['B']);
        const c = s.stream(['C']);
        expect(s.toArray(a.concat(b).concat(c))).toMatchObject(['A', 'B', 'C']);
    });

    test('empty streams', () => {
        const a = new s.EmptyStream();
        const b = new s.EmptyStream();
        expect(s.toArray(a.concat(b))).toMatchObject([]);
    });

    test('empty stream with array stream', () => {
        const a = s.stream(['A']);
        const b = new s.EmptyStream<string>();
        expect(s.toArray(a.concat(b))).toMatchObject(['A']);
    });

    test('array stream with empty stream', () => {
        const a = new s.EmptyStream<string>();
        const b = s.stream(['B']);
        expect(s.toArray(a.concat(b))).toMatchObject(['B']);
    });

});

describe('distinct', () => {

    test('empty stream returns empty stream', () => {
        expect(s.toArray(s.EMPTY_STREAM.distinct())).toMatchObject([]);
    });

    test('empty array stream returns empty stream', () => {
        expect(s.toArray(s.stream([]).distinct())).toMatchObject([]);
    });

    test('different items stay the same', () => {
        const stream = s.stream(['A', 'B', 'C']);
        expect(s.toArray(stream.distinct())).toMatchObject(['A', 'B', 'C']);
    });

    test('different items with different types stay the same', () => {
        const stream = s.stream(['A', 1, true]);
        expect(s.toArray(stream.distinct())).toMatchObject(['A', 1, true]);
    });

    test('duplicate entries are removed', () => {
        const stream = s.stream(['A', 'A', 'B']);
        expect(s.toArray(stream.distinct())).toMatchObject(['A', 'B']);
    });

    test('duplicate entries of different types stay the same', () => {
        const stream = s.stream(['1', 1, '2']);
        expect(s.toArray(stream.distinct())).toMatchObject(['1', 1, '2']);
    });

    test('distinct empty objects stay the same', () => {
        const a = {};
        const b = {};
        const stream = s.stream([a, b]);
        expect(s.toArray(stream.distinct())).toMatchObject([a, b]);
    });

    test('same objects are removed', () => {
        const a = {};
        const stream = s.stream([a, a]);
        expect(s.toArray(stream.distinct())).toMatchObject([a]);
    });

    test('distinct objects by value are removed', () => {
        const a = { value: 'A' };
        const b = { value: 'A' };
        const stream = s.stream([a, b]);
        expect(s.toArray(stream.distinct(e => e.value))).toMatchObject([a]);
    });

    test('distinct objects by value stay the same', () => {
        const a = { value: 'A' };
        const b = { value: 'B' };
        const stream = s.stream([a, b]);
        expect(s.toArray(stream.distinct(e => e.value))).toMatchObject([a, b]);
    });

});
