/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Range } from 'vscode-languageserver';
import type { JSDocLine, JSDocParagraph, JSDocTag } from 'langium';
import { describe, expect, test } from 'vitest';
import { parseJSDoc } from 'langium';

describe('JSDoc parsing', () => {

    describe('Comment start and end symbols', () => {

        test('Correctly deals with the default JSDoc symbols', () => {
            const defaultText = '/** A \n * B \n */';
            const parsed = parseJSDoc(defaultText);
            expect(parsed.toString()).toBe('A\n B');
        });

        test('Ignores missing symbols', () => {
            const defaultText = '/** A \n B */';
            const parsed = parseJSDoc(defaultText);
            expect(parsed.toString()).toBe('A\n B');
        });

        test('Can use XML comment symbols instead', () => {
            const defaultText = '<!-- A \n B -->';
            const parsed = parseJSDoc(defaultText, undefined, {
                start: '<!--',
                end: '-->'
            });
            expect(parsed.toString()).toBe('A\n B');
        });
    });

    describe('Text and tags', () => {

        test('Can parse multiline text', () => {
            const parsed = parseJSDoc('/** A \n   *   B  \n*C \n\n D*/');
            expect(parsed.elements).toHaveLength(2);
            expectRange(parsed.range, { start: { line: 0, character: 3 }, end: { line: 4, character: 2 } });
            const text = parsed.elements[0] as JSDocParagraph;
            expectRange(text.range, { start: { line: 0, character: 3 }, end: { line: 2, character: 2 } });
            expect(text).toHaveProperty('inlines');
            expect(text.inlines).toHaveLength(4);
            const lines = text.inlines;
            expect(lines[0]).toHaveProperty('text', ' A');
            expectRange(lines[0].range, { start: { line: 0, character: 3 }, end: { line: 0, character: 5 } });
            expect(lines[1]).toHaveProperty('text', '   B');
            expectRange(lines[1].range, { start: { line: 1, character: 4 }, end: { line: 1, character: 8 } });
            expect(lines[2]).toHaveProperty('text', 'C');
            expectRange(lines[2].range, { start: { line: 2, character: 1 }, end: { line: 2, character: 2 } });
            expect(lines[3]).toHaveProperty('text', '');
            expectRange(lines[3].range, { start: { line: 3, character: 0 }, end: { line: 3, character: 0 } });
            const d = parsed.elements[1] as JSDocParagraph;
            expectRange(d.range, { start: { line: 4, character: 0 }, end: { line: 4, character: 2 } });
            expect(d).toHaveProperty('inlines');
            const dLines = d.inlines;
            expect(dLines).toHaveLength(1);
            expect(dLines[0]).toHaveProperty('text', ' D');
        });

        test('Can parse multiline text with tags', () => {
            const parsed = parseJSDoc('/** A \n   *  @B  \n* @C D \n*/');
            expect(parsed.elements).toHaveLength(3);
            const text = parsed.elements[0] as JSDocParagraph;
            expect(text).toHaveProperty('inlines');
            expect(text.inlines).toHaveLength(1);
            expect(text.inlines[0]).toHaveProperty('text', ' A');
            const bTag = parsed.elements[1] as JSDocTag;
            expectRange(bTag.range, { start: { line: 1, character: 4 }, end: { line: 1, character: 8 } });
            expect(bTag).toHaveProperty('name', 'B');
            expect(bTag).toHaveProperty('inline', false);
            expect(bTag.content.inlines).toHaveLength(0);
            const cTag = parsed.elements[2] as JSDocTag;
            expect(cTag).toHaveProperty('name', 'C');
            expect(cTag).toHaveProperty('inline', false);
            expect(cTag.content.inlines).toHaveLength(1);
            const cTagLine = cTag.content.inlines[0];
            expect(cTagLine).toHaveProperty('text', 'D');
        });

        test('Can parse inline tags', () => {
            const parsed = parseJSDoc('/** A {@link B} C */');
            expect(parsed.elements).toHaveLength(1);
            const text = parsed.elements[0] as JSDocParagraph;
            expect(text.inlines).toHaveLength(3);
            const lines = text.inlines as [JSDocLine, JSDocTag, JSDocLine];
            expect(lines[0]).toHaveProperty('text', ' A ');
            expect(lines[1]).toHaveProperty('name', 'link');
            expect(lines[1]).toHaveProperty('inline', true);
            const bTagLine = lines[1].content.inlines[0];
            expect(bTagLine).toHaveProperty('text', 'B');
            expect(lines[2]).toHaveProperty('text', ' C');
        });
    });

    function expectRange(range: Range, expected: Range): void {
        expect(range.start.line, 'Unexpected start line value').toBe(expected.start.line);
        expect(range.start.character, 'Unexpected start character value').toBe(expected.start.character);
        expect(range.end.line, 'Unexpected end line value').toBe(expected.end.line);
        expect(range.end.character, 'Unexpected end character value').toBe(expected.end.character);
    }

});

describe('JSDoc rendering', () => {

    describe('Link rendering', () => {

        test('Renders URI as markdown link', () => {
            const parsed = parseJSDoc('/** {@link https://langium.org/} */');
            expect(parsed.toMarkdown()).toBe('[https://langium.org/](https://langium.org/)');
        });

        test('Renders URI as markdown linkcode #1', () => {
            const parsed = parseJSDoc('/** {@linkcode https://langium.org/} */');
            expect(parsed.toMarkdown()).toBe('[`https://langium.org/`](https://langium.org/)');
        });

        test('Renders URI as markdown linkcode #2', () => {
            const parsed = parseJSDoc('/** {@link https://langium.org/} */');
            expect(parsed.toMarkdown({ link: 'code' })).toBe('[`https://langium.org/`](https://langium.org/)');
        });

        test('Renders word as normal text', () => {
            const parsed = parseJSDoc('/** {@link Value} */');
            expect(parsed.toMarkdown()).toBe('Value');
        });

        test('Uses the supplied rendering function', () => {
            const parsed = parseJSDoc('/** {@link Y X} */');
            expect(parsed.toMarkdown({
                renderLink: (link, display) => {
                    if (display === 'X') {
                        return `[${display}](${link})`;
                    }
                    return undefined;
                }
            })).toBe('[X](Y)');
        });

    });

    describe('Tag rendering', () => {
        test('Renders single-line tags in markdown', () => {
            const parsed = parseJSDoc('/** @deprecated Since 1.0 */');
            expect(parsed.toMarkdown()).toBe('*@deprecated* — Since 1.0');
        });

        test('Renders single-line tags in plain text', () => {
            const parsed = parseJSDoc('/** @deprecated Since 1.0 */');
            expect(parsed.toString()).toBe('@deprecated Since 1.0');
        });

        test('Renders multi-line tags in markdown', () => {
            const parsed = parseJSDoc('/** @deprecated Since\n1.0*/');
            expect(parsed.toMarkdown()).toBe('*@deprecated*\nSince\n1.0');
        });

        test('Renders multi-line tags in plain text', () => {
            const parsed = parseJSDoc('/** @deprecated Since\n1.0*/');
            expect(parsed.toString()).toBe('@deprecated\nSince\n1.0');
        });

        test('Uses the supplied rendering function', () => {
            const parsed = parseJSDoc('/** @param p Lorem ipsum. */');
            expect(parsed.toMarkdown({
                renderTag: (tag) => {
                    const contentMd = tag.content.toMarkdown();
                    const [paramName, description] = contentMd.split(/\s(.*)/s);
                    return `**@${tag.name}** *${paramName}* — ${description.trim()}`;
                }
            })).toBe('**@param** *p* — Lorem ipsum.');
        });

    });

    test('Renders empty lines', () => {
        // This test ensures that newlines are rendered as they are in the input
        const parsed = parseJSDoc('/** ```\nA\n\n\nB\nC\n\n``` */');
        expect(parsed.toMarkdown()).toBe('```\nA\n\n\nB\nC\n\n```');
    });

    test('Renders paragraphs in markdown', () => {
        const parsed = parseJSDoc('/**\n * A\n * B\n * \n * C\n */');
        expect(parsed.toMarkdown()).toBe('A\n B\n\n C');
    });

    test('Renders paragraphs in plain text', () => {
        const parsed = parseJSDoc('/**\n * A\n * B\n * \n * C\n */');
        expect(parsed.toString()).toBe('A\n B\n\n C');
    });

});
