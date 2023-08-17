/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, expect, test } from 'vitest';
import { MultiMap } from 'langium';

describe('MultiMap', () => {

    test('addAll when empty', () => {
        const multimap = new MultiMap<string, string>();
        multimap.addAll('a', ['foo', 'bar', 'baz']);
        expect(multimap.size).toBe(3);
    });

    test('addAll when non-empty', () => {
        const multimap = new MultiMap<string, string>();
        multimap.add('a', 'foo');
        multimap.addAll('a', ['bar', 'baz']);
        expect(multimap.size).toBe(3);
    });

    test('size', () => {
        const multimap = new MultiMap<string, string>();
        multimap.add('a', 'foo');
        multimap.add('a', 'bar');
        multimap.add('b', 'baz');
        expect(multimap.size).toBe(3);
    });

    test('delete a single value', () => {
        const multimap = new MultiMap<string, string>();
        multimap.add('a', 'foo');
        multimap.add('a', 'bar');
        multimap.delete('a', 'foo');
        expect(multimap.get('a')).toMatchObject(['bar']);
    });

    test('delete all values', () => {
        const multimap = new MultiMap<string, string>();
        multimap.add('a', 'foo');
        multimap.add('a', 'bar');
        multimap.delete('a');
        expect(multimap.get('a')).toMatchObject([]);
    });

    test('get from empty map', () => {
        const multimap = new MultiMap<string, string>();
        expect(multimap.get('a')).toMatchObject([]);
    });

    test('has a single value', () => {
        const multimap = new MultiMap<string, string>();
        multimap.add('a', 'foo');
        multimap.add('a', 'bar');
        expect(multimap.has('a', 'foo')).toBe(true);
    });

    test('has any value', () => {
        const multimap = new MultiMap<string, string>();
        multimap.add('a', 'foo');
        multimap.add('a', 'bar');
        expect(multimap.has('a')).toBe(true);
    });

    test('has no value', () => {
        const multimap = new MultiMap<string, string>();
        expect(multimap.has('a')).toBe(false);
    });

    test('has no value after delete', () => {
        const multimap = new MultiMap<string, string>();
        multimap.add('a', 'foo');
        multimap.add('a', 'bar');
        multimap.delete('a', 'foo');
        multimap.delete('a', 'bar');
        expect(multimap.has('a')).toBe(false);
    });

    test('forEach reaches every value', () => {
        const multimap = new MultiMap<string, number>();
        multimap.add('a', 1);
        multimap.add('a', 2);
        multimap.add('b', 3);
        let sum = 0;
        multimap.forEach(v => {
            sum += v;
        });
        expect(sum).toBe(6);
    });

    test('entries reaches every value', () => {
        const multimap = new MultiMap<string, number>();
        multimap.add('a', 1);
        multimap.add('a', 2);
        multimap.add('b', 3);
        let sum = 0;
        multimap.entries().forEach(([_, v]) => {
            sum += v;
        });
        expect(sum).toBe(6);
    });

    test('values reaches every value', () => {
        const multimap = new MultiMap<string, number>();
        multimap.add('a', 1);
        multimap.add('a', 2);
        multimap.add('b', 3);
        let sum = 0;
        multimap.values().forEach(v => {
            sum += v;
        });
        expect(sum).toBe(6);
    });

});
