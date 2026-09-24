/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { expectFormatting } from 'langium/test';
import { createArithmeticsServices } from '../src/language-server/arithmetics-module.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const services = createArithmeticsServices({ ...EmptyFileSystem }).arithmetics;
const formatting = expectFormatting(services);

describe('Arithmetics formatting', () => {

    test('Should preserve well-formatted example.calc content', async () => {
        const examplePath = resolve(__dirname, '../example/example.calc');
        const exampleContent = readFileSync(examplePath, 'utf-8');

        await formatting({
            before: exampleContent,
            after: exampleContent
        });
    });

    test('Should format module declaration correctly', async () => {
        await formatting({
            before: 'Module    basicMath      def a:5;',
            after: `Module basicMath
def a: 5;`
        });
    });

    test('Should keep each definition on a separate line', async () => {
        await formatting({
            before: 'Module test\ndef a:5;\ndef b   :   3;',
            after: `Module test
def a: 5;
def b: 3;`
        });
    });

    test('Should format parentheses of nested expressions', async () => {
        await formatting({
            before: `Module test
def result: ( a + (  b ) ) * c^(  1/a);
def root(x, y):x^(  1/y);
def reuse(a,b):(  root (  a,b )  ) ;
 ( result + root ( result ,reuse  (  2 , 3 )  ) )/2;`,
            after: `Module test
def result: (a + (b)) * c^(1/a);
def root(x, y):
    x^(1/y);
def reuse(a, b):
    (root(a, b));
(result + root(result, reuse(2, 3)))/2;`
        });
    });

    test('Should have space after colon for expression definitions', async () => {
        await formatting({
            before: `Module test
def d:(x*y);`,
            after: `Module test
def d: (x*y);`
        });
    });

    test('Should handle function calls with no spaces around parentheses and a single space after comma', async () => {
        await formatting({
            before: `Module test
def a: 5;
root  (   a  ,   2   );
sqrt(   x   );`,
            after: `Module test
def a: 5;
root(a, 2);
sqrt(x);`
        });
    });

    test('Should format function definitions with no spaces around parentheses and a single space after comma', async () => {
        await formatting({
            before: `Module test
def root(  x  ,y,   z   ):
    x^y;`,
            after: `Module test
def root(x, y, z):
    x^y;`
        });
    });

    test('Should format nested expressions with proper parentheses spacing (preserving operator spacing)', async () => {
        await formatting({
            before: `Module test
def complex: (  ( a + b )  *  ( c - d )  )  +  ( e / f );`,
            after: `Module test
def complex: ((a + b)  *  (c - d))  +  (e / f);`
        });
    });

    test('Should format statements with proper semicolon spacing', async () => {
        await formatting({
            before: `Module test
def a: 5;
def root(x, y, z):
    x^y ;
b % 2    ;`,
            after: `Module test
def a: 5;
def root(x, y, z):
    x^y;
b % 2;`
        });
    });

    test('Should preserve extra empty lines and comments', async () => {
        const multilineArithmetics = 'Module test\n\ndef a: 5;// this is a comment\n//   Another comment\n\ndef root(x, y):\n    x^(1/y);\n\n2*a;';
        await formatting({
            before: multilineArithmetics,
            after: multilineArithmetics
        });
    });
});
