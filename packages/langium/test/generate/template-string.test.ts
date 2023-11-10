/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { expect, test } from 'vitest';
import { expandToStringLF as s } from 'langium/generate';

test('Should not throw when substituting null', () => {
    expect(s`${null}`).toBe('null');
});

test('Should not throw when substituting undefined', () => {
    expect(s`${undefined}`).toBe('');
});

test('Should omit lines containing just a subsitution being undefined', () => {
    const expected = `123
456
abc
def`;
    expect(s`
        123
        ${456}
        ${undefined}
        ${'abc'}
        def
    `).toBe(expected);
});

test('Should indent empty string', () => {
    expect(s``).toBe('');
});

test('Should indent simple string containing NaN', () => {
    expect(s`${NaN}`).toBe('NaN');
});

test('Should indent simple string containing double', () => {
    expect(s`${1.0}`).toBe('1');
});

test('Should indent simple string containing string', () => {
    expect(s`${'ok'}`).toBe('ok');
});

test('Should indent frayed strings', () => {
    expect(frayedIndentation).toBe(expectedFrayedIndentation);
});

test('Should indent multiline string containing no empty lines', () => {
    expect(trimmedMultilineString).toBe(expectedTrimmedMultilineString);
});

test('Should indent multiline string containing empty lines and trailing whitespace', () => {
    expect(multilineStringWithWhitespace).toBe(expectedMultilineStringWithWhitespace);
});

test('Should indent nested multiline strings', () => {
    expect(generator()).toBe(expectedGeneratorOutput);
});

test('Should indent frayed multiline strings', () => {
    expect(nestedIndentation).toBe(expectedNestedIndentation);
});

const frayedIndentation = s`
    test1
  test2
`;

const expectedFrayedIndentation = `  test1
test2`;

const trimmedMultilineString = s`
  ${1}
`;

const expectedTrimmedMultilineString = '1';

const multilineStringWithWhitespace = s`
      // we add some right space
      ${1}${'    '}
        ${2}${'  '}
          ${3}${''}
    `;

const expectedMultilineStringWithWhitespace = '// we add some right space\n1\n  2\n    3';

const generator = () => {
    const applyMethod = (paramName: string) => s`
        R apply(T ${paramName});
        boolean isDefinedAt(T ${paramName});
    `;
    const toStringMethod = s`
        @Override
        String toString() { return "T -> R"; }
    `;
    return s`
        public interface PartialFunction<T, R> {
            ${applyMethod('t')}
            ${toStringMethod}
        }
    `;
};

const expectedGeneratorOutput = `public interface PartialFunction<T, R> {
    R apply(T t);
    boolean isDefinedAt(T t);
    @Override
    String toString() { return "T -> R"; }
}`;

const nestedIndentation = s`
${1}x
  ${s`
      test1
  test2
  `}
`;

const expectedNestedIndentation = `1x
      test1
  test2`;
