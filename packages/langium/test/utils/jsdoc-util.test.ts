/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { JSDocLine, JSDocParagraph, JSDocTag, parseJSDoc } from '../../src';

describe('JSDoc parsing', () => {

    describe('Comment start and end symbols', () => {

        test('Correctly deals with the default JSDoc symbols', () => {
            const defaultText = '/** A \n * B */';
            const parsed = parseJSDoc(defaultText);
            expect(parsed.toString()).toBe('A\nB');
        });

        test('Ignores missing symbols', () => {
            const defaultText = '/** A \n B */';
            const parsed = parseJSDoc(defaultText);
            expect(parsed.toString()).toBe('A\nB');
        });

        test('Can use XML comment symbols instead', () => {
            const defaultText = '<!-- A \n B -->';
            const parsed = parseJSDoc(defaultText, undefined, {
                start: '<!--',
                end: '-->'
            });
            expect(parsed.toString()).toBe('A\nB');
        });
    });

    describe('Text and tags', () => {

        test('Can parse multiline text', () => {
            const parsed = parseJSDoc('/** A \n   *   B  \n*C \n\n D*/');
            expect(parsed.elements).toHaveLength(2);
            const text = parsed.elements[0] as JSDocParagraph;
            expect(text.inlines).toHaveLength(4);
            const lines = text.inlines as JSDocLine[];
            expect(lines[0].text).toBe('A');
            expect(lines[1].text).toBe('B');
            expect(lines[2].text).toBe('C');
            expect(lines[3].text).toBe('');
            const d = parsed.elements[1] as JSDocParagraph;
            const dLines = d.inlines as JSDocLine[];
            expect(dLines).toHaveLength(1);
            expect(dLines[0].text).toBe('D');
        });

        test('Can parse multiline text with tags', () => {
            const parsed = parseJSDoc('/** A \n   *  @B  \n* @C D \n*/');
            expect(parsed.elements).toHaveLength(3);
            const text = parsed.elements[0] as JSDocParagraph;
            expect(text.inlines).toHaveLength(1);
            const lines = text.inlines as [JSDocLine];
            expect(lines[0].text).toBe('A');
            const bTag = parsed.elements[1] as JSDocTag;
            expect(bTag.name).toBe('B');
            expect(bTag.inline).toBeFalsy();
            expect(bTag.content.inlines).toHaveLength(0);
            const cTag = parsed.elements[2] as JSDocTag;
            expect(cTag.name).toBe('C');
            expect(cTag.inline).toBeFalsy();
            expect(cTag.content.inlines).toHaveLength(1);
            const cTagLine = cTag.content.inlines[0] as JSDocLine;
            expect(cTagLine.text).toBe('D');
        });

        test('Can parse inline tags', () => {
            const parsed = parseJSDoc('/** A {@link B} C */');
            expect(parsed.elements).toHaveLength(1);
            const text = parsed.elements[0] as JSDocParagraph;
            expect(text.inlines).toHaveLength(3);
            const lines = text.inlines as [JSDocLine, JSDocTag, JSDocLine];
            expect(lines[0].text).toBe('A ');
            expect(lines[1].inline).toBeTruthy();
            expect(lines[1].name).toBe('link');
            const bTagLine = lines[1].content.inlines[0] as JSDocLine;
            expect(bTagLine.text).toBe('B');
            expect(lines[2].text).toBe(' C');
        });
    });

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

    test('Renders empty lines', () => {
        const parsed = parseJSDoc('/** ```\nA\n\n``` */');
        expect(parsed.toMarkdown()).toBe('```\nA\n\n```');
    });

    test('Renders single line tags', () => {
        const parsed = parseJSDoc('/** @deprecated Since 1.0 */');
        expect(parsed.toMarkdown()).toBe('*@deprecated* — Since 1.0');
    });

    test('Renders multi line tags', () => {
        const parsed = parseJSDoc('/** @deprecated Since\n1.0*/');
        expect(parsed.toMarkdown()).toBe('*@deprecated*\nSince\n1.0');
    });

});