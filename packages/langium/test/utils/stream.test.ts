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
