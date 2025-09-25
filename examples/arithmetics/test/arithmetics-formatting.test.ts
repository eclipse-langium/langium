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

    // Note: The current formatter preserves existing spacing around commas in parameter lists
    // due to a known limitation (see TODO comment in ArithmeticsFormatter)

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

    test('Should format constant definitions with proper spacing', async () => {
        await formatting({
            before: 'Module test\ndef a:5;\ndef b   :   3;',
            after: `Module test
def a: 5;
def b: 3;`
        });
    });

    test('Should format function definitions with parameters (preserving existing comma spacing)', async () => {
        await formatting({
            before: 'Module test\ndef root( x, y ):\n  x^(1/y);',
            after: `Module test
def root(x, y):
    x^(1/y);`
        });
    });

    test('Should format function calls with proper spacing (preserving existing comma spacing)', async () => {
        await formatting({
            before: 'Module test\ndef a: 5;\nroot( a, 2 );',
            after: `Module test
def a: 5;
root(a, 2);`
        });
    });

    test('Should format binary expressions with parentheses correctly', async () => {
        await formatting({
            before: 'Module test\ndef result: ( a + b ) * c;',
            after: `Module test
def result: (a + b) * c;`
        });
    });

    test('Should format evaluation statements correctly', async () => {
        await formatting({
            before: 'Module test\n  def a\n:\n   5 \n; \n2 * a    ;',
            after: `Module test
def a: 5;
2 * a;`
        });
    });

    test('Should handle mixed formatting issues (preserving empty lines between statements and comma spacing)', async () => {
        await formatting({
            before: `Module    test

def   a   :   5   ;
def   root(   x, y   )   :
      x^(1/y)   ;

2*a    ;`,
            after: `Module test

def a: 5;
def root(x, y):
    x^(1/y);

2*a;`
        });
    });

    test('Should preserve comments', async () => {
        await formatting({
            before: `Module test
def a: 5; // this is a comment
// Another comment
def b: 3;`,
            after: `Module test
def a: 5; // this is a comment
// Another comment
def b: 3;`
        });
    });

});
