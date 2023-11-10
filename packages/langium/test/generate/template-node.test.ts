/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { stream } from 'langium';
import { CompositeGeneratorNode, EOL, NL, joinToNode, expandToNode as n, expandToString as s, toString } from 'langium/generate';
import { describe, expect, test } from 'vitest';

// deactivate the eslint check 'no-unexpected-multiline' with the message
//  'Unexpected newline between template tag and template literal', as that's done on purposes in tests below!
/* eslint-disable no-unexpected-multiline */

describe('Empty templates', ()=> {
    test('Plain call with empty template', () => {
        const node = n``;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('Single line template with WS only', () => {
        const node = n`  `;
        const text = toString(node);
        expect(text).toBe('  ');
    });
    test('Empty template with single line break', () => {
        const node = n`
        `;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('Empty template with empty indented line', () => {
        const node = n`
            
        `;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('Empty template with empty 2 indented lines', () => {
        const node = n`
            
            
        `;
        const text = toString(node);
        expect(text).toBe(EOL);
    });
    test('Empty template with empty 2 indented lines, with an empty one in-between', () => {
        const node = n`
            

            
        `;
        const text = toString(node);
        expect(text).toBe(EOL+EOL);
    });
    test('Empty template with empty 2 indented lines, 1st containing additional spaces', () => {
        const node = n`
              
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + EOL);
    });
    test('Empty template with empty 2 indented lines, 2nd containing additional spaces', () => {
        const node = n`
            
              
        `;
        const text = toString(node);
        expect(text).toBe(EOL + '  ');
    });
    test('Empty template with empty 2 indented lines, 2nd containing additional spaces followed by the template terminator', () => {
        const node = n`
            
              `;
        const text = toString(node);
        expect(text).toBe(EOL + '  ');
    });
});

describe('Plain text templates', () => {
    test('Plain text without leading and trailing line breaks', () => {
        const node = n`Generated text!`;
        const text = toString(node);
        expect(text).toBe('Generated text!');
    });
    test('Plain text with trailing line break', () => {
        const node = n`Generated text!
        `;
        const text = toString(node);
        // IMO there's no justification to treat the linebreak as ignorable white space
        expect(text).toBe('Generated text!' + EOL);
    });
    test('Plain text with trailing line break, and with leading WS', () => {
        const node = n` Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(' Generated text!' + EOL);
    });
    test('Plain text with trailing line break, and with leading and trailing WS', () => {
        const node = n` Generated text! 
        `;
        const text = toString(node);
        expect(text).toBe(' Generated text! ' + EOL);
    });
    test('Plain text with leading line break', () => {
        const node = n`
            Generated text!`;
        const text = toString(node);
        expect(text).toBe('Generated text!');
    });
    test('Plain text with leading and trailing line breaks', () => {
        const node = n`
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe('Generated text!');
    });

    test('With preceding WS 1', () => {
        const node = n`

            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + 'Generated text!');
    });
    test('With preceding WS 1.1', () => {
        const node = n`
            
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + 'Generated text!');
    });
    test('With preceding WS 1.2', () => {
        const node = n`
             
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(' ' + EOL + 'Generated text!');
    });
    test('With preceding WS 1.3', () => {
        const node = n`
            
            
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + EOL + 'Generated text!');
    });
    test('With preceding WS 1.4', () => {
        const node = n`

            
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + EOL + 'Generated text!');
    });
    test('With preceding WS 1.5', () => {
        const node = n`
            

            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + EOL + 'Generated text!');
    });
    test('With preceding WS 1.6', () => {
        const node = n`


            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + EOL + 'Generated text!');
    });
    test('With preceding WS 1.7', () => {
        const node = n`
             
            
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(' ' + EOL + EOL + 'Generated text!');
    });

    test('With preceding WS 2', () => {
        const node = n
        `

            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + 'Generated text!');
    });
    test('With preceding WS 2.1', () => {
        const node = n
        `
            
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + 'Generated text!');
    });
    test('With preceding WS 2.2', () => {
        const node = n
        `
             
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(' ' + EOL + 'Generated text!');
    });
    test('With preceding WS 2.3', () => {
        const node = n
        `
            
            
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + EOL + 'Generated text!');
    });
    test('With preceding WS 2.4', () => {
        const node = n
        `

            
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + EOL + 'Generated text!');
    });
    test('With preceding WS 2.5', () => {
        const node = n
        `
            

            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + EOL + 'Generated text!');
    });
    test('With preceding WS 2.6', () => {
        const node = n
        `


            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(EOL + EOL + 'Generated text!');
    });
    test('With preceding WS 2.7', () => {
        const node = n
        `
             
            
            Generated text!
        `;
        const text = toString(node);
        expect(text).toBe(' ' + EOL + EOL + 'Generated text!');
    });

    test('With succeding WS 1', () => {
        const node = n`
            Generated text!

        `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL);
    });
    test('With succeding WS 1.1', () => {
        const node = n`
            Generated text!
            
        `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL);
    });
    test('With succeding WS 1.2', () => {
        const node = n`
            Generated text!
             
        `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + ' ');
    });
    test('With succeding WS 1.3', () => {
        const node = n`
            Generated text!
            
            
        `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + EOL);
    });
    test('With succeding WS 1.4', () => {
        const node = n`
            Generated text!

            
        `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + EOL);
    });
    test('With succeding WS 1.5', () => {
        const node = n`
            Generated text!
            

        `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + EOL);
    });
    test('With succeding WS 1.6', () => {
        const node = n`
            Generated text!


        `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + EOL);
    });
    test('With succeding WS 1.7', () => {
        const node = n`
            Generated text!

             
        `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + EOL + ' ');
    });
    test('With succeding WS 1.8', () => {
        const node = n`
            Generated text!
            
             
        `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + EOL + ' ');
    });

    test('With succeding WS 2', () => {
        const node = n`
            Generated text!
            `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL);
    });
    test('With succeding WS 2.2', () => {
        const node = n`
            Generated text!
             `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + ' ');
    });
    test('With succeding WS 2.3', () => {
        const node = n`
            Generated text!

            `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + EOL);
    });
    test('With succeding WS 2.4', () => {
        const node = n`
            Generated text!
            
            `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + EOL);
    });
    test('With succeding WS 2.5', () => {
        const node = n`
            Generated text!

             `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + EOL + ' ');
    });
    test('With succeding WS 2.6', () => {
        const node = n`
            Generated text!
            
             `;
        const text = toString(node);
        expect(text).toBe('Generated text!' + EOL + EOL + ' ');
    });
});

const TEXT_TEMPLATE = 'Generated text!';

describe('Single substitution templates', () => {
    test('Single substitution without leading and trailing line breaks', () => {
        const node = n`${TEXT_TEMPLATE}`;
        const text = toString(node);
        expect(text).toBe(TEXT_TEMPLATE);
    });
    test('Single substitution without leading and trailing line breaks, with leading WS', () => {
        const node = n` ${TEXT_TEMPLATE}`;
        const text = toString(node);
        expect(text).toBe(' ' + TEXT_TEMPLATE);
    });
    test('Single substitution with trailing line break', () => {
        const node = n`${TEXT_TEMPLATE}
        `;
        const text = toString(node);
        expect(text).toBe(TEXT_TEMPLATE + EOL);
    });
    test('Single substitution with trailing line break, with leading WS', () => {
        const node = n` ${TEXT_TEMPLATE}
        `;
        const text = toString(node);
        expect(text).toBe(' ' + TEXT_TEMPLATE + EOL);
    });
    test('Single substitution with leading line break', () => {
        const node = n`
            ${TEXT_TEMPLATE}`;
        const text = toString(node);
        expect(text).toBe(TEXT_TEMPLATE);
    });
    test('Single substitution with leading and trailing line breaks', () => {
        const node = n`
            ${TEXT_TEMPLATE}
        `;
        const text = toString(node);
        expect(text).toBe(TEXT_TEMPLATE);
    });
    test('With additional preceding line breaks', () => {
        const node = n`
            
            ${TEXT_TEMPLATE}
        `;
        const text = toString(node);
        expect(text).toBe('' + EOL + TEXT_TEMPLATE);
    });
    test('With additional succeding line breaks', () => {
        const node = n`
            ${TEXT_TEMPLATE}
            
        `;
        const text = toString(node);
        expect(text).toBe(TEXT_TEMPLATE + EOL);
    });
    test('With additional succeding line breaks, and with leading WS', () => {
        const node = n`
              ${TEXT_TEMPLATE}
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + TEXT_TEMPLATE + EOL);
    });
});

describe('Empty string & white space vs. undefined in substitution', () => {
    test('2 empty lines', () => {
        const node = n`
            
            
        `;
        const text = toString(node);
        expect(text).toBe(EOL);
    });
    test('2 empty lines, first indented', () => {
        const node = n`
              
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + EOL);
    });
    test('2 empty lines, first indented with substitution to empty string (last one)', () => {
        const node = n`
              ${''}
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + EOL);
    });
    test('2 empty lines, first indented with substitution to empty string (last one) and trailing ws', () => {
        const node = n`
              ${''}  
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + '  ' + EOL);
    });
    test('2 empty lines, first indented with substitution to ws (last one)', () => {
        const node = n`
              ${'  '}
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + '  ' + EOL);
    });
    test('2 empty lines, first indented with substitution to ws (last one) and trailing ws', () => {
        const node = n`
              ${'  '}  
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + '  ' + '  ' + EOL);
    });
    test('2 empty lines, first indented with substitution to generator node (last one) => to be dropped', () => {
        const node = n`
              ${new CompositeGeneratorNode()}
            
        `;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('2 empty lines, first indented with substitution to generator node (last one) and trailing ws => to be dropped', () => {
        const node = n`
              ${new CompositeGeneratorNode()}  
            
        `;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('2 empty lines, first indented with substitution to undefined (last one) => to be dropped', () => {
        const node = n`
              ${undefined}
            
        `;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('2 empty lines, first indented with substitution to undefined (last one) and trailing ws => to be dropped', () => {
        // expected the same result as for the case without trailing ws (previous test case)
        const node = n`
              ${undefined}  
            
        `;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('2 lines, first indented with substitution to undefined (last one) and trailing non-ws => to be kept', () => {
        // expected the same result as for the case without trailing ws (previous test case)
        const node = n`
              ${undefined} a
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + ' a' + EOL);
    });
    test('2 empty lines, first indented with 2 substitutions to empty string and undefined (last one) => to be dropped', () => {
        const node = n`
              ${''}${undefined}
            
        `;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('2 empty lines, first indented with 2 substitutions to empty string and undefined (last one) and trailing ws => to be dropped', () => {
        // expected the same result as for the case without trailing ws (previous test case)
        const node = n`
              ${''}${undefined}  
            
        `;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('2 empty lines, first indented with 2 substitutions to ws and undefined (last one) => to be dropped', () => {
        const node = n`
              ${'  '}${undefined}
            
        `;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('2 empty lines, first indented with 2 substitutions to ws and undefined (last one) and trailing ws => to be dropped', () => {
        // expected the same result as for the case without trailing ws (previous test case)
        const node = n`
              ${'  '}${undefined}  
            
        `;
        const text = toString(node);
        expect(text).toBe('');
    });
    test('2 lines, first indented with 2 substitutions to non-ws and undefined (last one) => to be kept', () => {
        const node = n`
              ${'a'}${undefined}
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + 'a' + EOL);
    });
    test('2 empty lines, first indented with 2 substitutions to undefined and empty string (last one) => to be kept', () => {
        const node = n`
              ${undefined}${''}
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + EOL);
    });
    test('2 empty lines, first indented with 2 substitutions to undefined and empty string (last one) and trailing ws => to be kept', () => {
        // expected the same result as for the case without trailing ws (previous test case)
        const node = n`
              ${undefined}${''}  
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + '  ' + EOL);
    });
    test('2 empty lines, first indented with 2 substitutions to undefined and ws (last one) => to be kept', () => {
        const node = n`
              ${undefined}${'  '}
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + '  ' + EOL);
    });
    test('2 empty lines, first indented with 2 substitutions to undefined and ws (last one) and trailing ws => to be kept', () => {
        // expected the same result as for the case without trailing ws (previous test case)
        const node = n`
              ${undefined}${'  '}  
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + '  ' + '  ' + EOL);
    });
});

describe('Multiple substitution templates', () => {

    test('One line 2 substitutions', () => {
        const node = n`${TEXT_TEMPLATE} ${TEXT_TEMPLATE}`;
        const text = toString(node);
        expect(text).toBe(`${TEXT_TEMPLATE} ${TEXT_TEMPLATE}`);
    });

    test('Two lines 2 substitutions', () => {
        const node = n`
                ${TEXT_TEMPLATE} ${TEXT_TEMPLATE}
            ${TEXT_TEMPLATE} ${TEXT_TEMPLATE}
        `;
        const text = toString(node);
        expect(text).toBe(`    ${TEXT_TEMPLATE} ${TEXT_TEMPLATE}${EOL}${TEXT_TEMPLATE} ${TEXT_TEMPLATE}`);
    });

    test('One line 3 substitutions', () => {
        const node = n`${TEXT_TEMPLATE} ${TEXT_TEMPLATE} ${TEXT_TEMPLATE}`;
        const text = toString(node);
        expect(text).toBe(`${TEXT_TEMPLATE} ${TEXT_TEMPLATE} ${TEXT_TEMPLATE}`);
    });

    test('Two lines 3 substitutions', () => {
        const node = n`
                ${TEXT_TEMPLATE} ${TEXT_TEMPLATE} ${TEXT_TEMPLATE}
            ${TEXT_TEMPLATE} ${TEXT_TEMPLATE} ${TEXT_TEMPLATE}
        `;
        const text = toString(node);
        expect(text).toBe(`    ${TEXT_TEMPLATE} ${TEXT_TEMPLATE} ${TEXT_TEMPLATE}${EOL}${TEXT_TEMPLATE} ${TEXT_TEMPLATE} ${TEXT_TEMPLATE}`);
    });
});

describe('Nested substitution templates', () => {
    const nestedNode = n`
        ${TEXT_TEMPLATE}
    `;

    test('Single substitution', () => {
        const node = n`
            ${nestedNode}
        `;
        const text = toString(node);
        expect(text).toBe(TEXT_TEMPLATE);
    });
    test('With additional preceding line breaks', () => {
        const node = n`
            
            ${nestedNode}
        `;
        const text = toString(node);
        expect(text).toBe('' + EOL + TEXT_TEMPLATE);
    });
    test('With additional succeding line breaks', () => {
        const node = n`
            ${nestedNode}
            
        `;
        const text = toString(node);
        expect(text).toBe(TEXT_TEMPLATE + EOL);
    });

    test('With indented line ws-only line with \'undefined\' substitution', () => {
        const node = n`
                {
                    ${undefined}
                }
        `;
        const text = toString(n`
            non-indented
                ${node}
            non-indented
        `);
        expect(text).toBe(s`
            non-indented
                {
                }
            non-indented
        `);
    });
});

const ML_TEXT_TEMPLATE = 'More' + EOL + 'generated text!';

describe('Single multiline substitution templates', () => {
    test('Single substitution', () => {
        const node = n`
            ${ML_TEXT_TEMPLATE}
        `;
        const text = toString(node);
        expect(text).toBe(ML_TEXT_TEMPLATE);
    });
    test('With preceding WS', () => {
        const node = n`
            
            ${ML_TEXT_TEMPLATE}
        `;
        const text = toString(node);
        expect(text).toBe('' + EOL + ML_TEXT_TEMPLATE);
    });
    test('With succeding WS', () => {
        const node = n`
            ${ML_TEXT_TEMPLATE}
            
        `;
        const text = toString(node);
        expect(text).toBe(ML_TEXT_TEMPLATE + EOL);
    });
    test('With succeding WS 2', () => {
        const node = n`
              ${ML_TEXT_TEMPLATE}
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + ML_TEXT_TEMPLATE + EOL);
    });
});

describe('Nested multiline substitution templates', () => {
    const nestedNode = n`
        More
        generated text!
    `;

    test('Single substitution', () => {
        const node = n`
            ${nestedNode}
        `;
        const text = toString(node);
        expect(text).toBe(ML_TEXT_TEMPLATE);
    });
    test('With additional preceding line breaks', () => {
        const node = n`
            
            ${nestedNode}
        `;
        const text = toString(node);
        expect(text).toBe('' + EOL + ML_TEXT_TEMPLATE);
    });
    test('With additional succeding line breaks', () => {
        const node = n`
            ${nestedNode}
            
        `;
        const text = toString(node);
        expect(text).toBe(ML_TEXT_TEMPLATE + EOL);
    });
    test('With additional succeding line breaks, and with leading WS', () => {
        const node = n`
              ${nestedNode}
            
        `;
        const text = toString(node);
        expect(text).toBe('  ' + ML_TEXT_TEMPLATE.replace('' + EOL, EOL + '  ') + EOL);
    });
    test('With additional leading line breaks, and with leading WS', () => {
        const node = n`
            
              ${nestedNode}
        `;
        const text = toString(node);
        expect(text).toBe(EOL + '  ' + ML_TEXT_TEMPLATE.replace('' + EOL, EOL + '  '));
    });
    test('Plain text and multiple nested node references', () => {
        const node = n`
            Hans:
            
              ${nestedNode}
                ${nestedNode}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Hans:
            
              More
              generated text!
                More
                generated text!
        `);
    });
});
describe('Multiple nested substitution templates', () => {
    const nestedNode = n`
        More
        generated text!
    `;

    const nestedNode2 = n`
        Title:
            indented
                ${nestedNode}
    `;

    test('Nested substitution using 2 templates', () => {
        expect(
            toString(n`
                Heading:
                    ${nestedNode2}
            `)
        ).toBe(s`
            Heading:
                Title:
                    indented
                        More
                        generated text!
        `);
    });
});

describe('Embedded forEach loops', () => {
    test('ForEach loop with empty iterable', () => {
        const node = n`
            Data:
              ${joinToNode([], String, { appendNewLineIfNotEmpty: true})}
            Footer:
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
            Footer:
        `);
    });
    test('ForEach loop with empty iterable 2 (\'toGenerated\' === \'undefined\')', () => {
        const node = n`
            Data:
              ${joinToNode([], undefined, { appendNewLineIfNotEmpty: true})}
            Footer:
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
            Footer:
        `);
    });
    test('ForEach loop with empty iterable 3 (no \'toGenerated\')', () => {
        const node = n`
            Data:
              ${joinToNode([], { appendNewLineIfNotEmpty: true})}
            Footer:
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
            Footer:
        `);
    });
    test('ForEach loop with Array input (no \'toGenerated\', no \'options\')', () => {
        const node = n`
            Data:
              ${joinToNode(['a', 'b'])}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              ab
        `);
    });
    test('ForEach loop with separator and Array input', () => {
        const node = n`
            Data:
              ${joinToNode(['a', 'b'], String, { separator: ', ' })}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a, b
        `);
    });
    test('ForEach loop with separator and Array input 2 (\'toGenerated\' === \'undefined\')', () => {
        const node = n`
            Data:
              ${joinToNode(['a', 'b'], undefined, { separator: ', ' })}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a, b
        `);
    });
    test('ForEach loop with separator and Array input 3 (no \'toGenerated\')', () => {
        const node = n`
            Data:
              ${joinToNode(['a', 'b'], { separator: ', ' })}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a, b
        `);
    });
    test('ForEach loop with separator and Array of generator nodes input', () => {
        const node = n`
            Data:
              ${joinToNode([n`a`, ' b', NL], n => n, { separator: ',' })}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a, b,

        `);
    });
    test('ForEach loop with separator and Array of generator nodes input 2 (\'toGenerated\' === \'undefined\')', () => {
        const node = n`
            Data:
              ${joinToNode([n`a`, ' b', NL], undefined, { separator: ',' })}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a, b,

        `);
    });
    test('ForEach loop with separator and Array of generator nodes input 3 (no \'toGenerated\')', () => {
        const node = n`
            Data:
              ${joinToNode([n`a`, ' b', NL], { separator: ',' })}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a, b,

        `);
    });
    test('ForEach loop with element prefix and Array input', () => {
        const node = n`
            Data:
              ${joinToNode(['a', 'b'], String, { prefix: ',' })}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              ,a,b
        `);
    });
    test('ForEach loop with element prefix and Array input 2 (function)', () => {
        const node = n`
            Data:
              ${joinToNode(['a', 'b'], String, { prefix: (e, i) => i === 0 ? '': ', ' })}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a, b
        `);
    });
    test('ForEach loop with element suffix and Set input', () => {
        const node = n`
            Data:
              ${joinToNode(new Set(['a', 'b']), String, { suffix: ',' })}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a,b,
        `);
    });
    test('ForEach loop with element suffix and Set input 2 (function)', () => {
        const node = n`
            Data:
              ${joinToNode(new Set(['a', 'b']), String, { suffix: (e, i, isLast) => isLast ? '': ', ' })}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a, b
        `);
    });
    test('ForEach loop with Stream input (no \'toGenerated\', no \'options\')', () => {
        const node = n`
            Data:
              ${joinToNode(stream('a', 'b'))}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              ab
        `);
    });
    test('ForEach loop with line breaks and Stream input', () => {
        const node = n`
            Data:
              ${joinToNode(stream(['a', 'b']), String, { appendNewLineIfNotEmpty: true})}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a
              b
            
        `);
    });
    test('ForEach loop with line breaks and skip line break after last line and Stream input', () => {
        const node = n`
            Data:
              ${joinToNode(stream(['a', 'b']), String, { appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true})}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a
              b
        `);
    });
    test('ForEach loop with separator, line breaks, and Stream input', () => {
        const node = n`
            Data:
              ${joinToNode(stream(['a', undefined, 'b']), String, { separator: ',', appendNewLineIfNotEmpty: true})}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a,
              undefined,
              b
            
        `);
    });
    test('ForEach loop with separator, line breaks and skip line break after last line, and Stream input', () => {
        const node = n`
            Data:
              ${joinToNode(stream(['a', undefined, 'b']), String, { separator: ',', appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true})}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a,
              undefined,
              b
        `);
    });
    test('ForEach loop with omitted `undefined`, separator, line breaks and Stream input', () => {
        const node = n`
            Data:
              ${joinToNode(stream(['a', undefined, 'b']), e => e && String(e), { separator: ',', appendNewLineIfNotEmpty: true})}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a,
              b
            
        `);
    });
    test('ForEach loop with omitted `undefined`, separator, line breaks and skip line break after last line, and Stream input', () => {
        const node = n`
            Data:
              ${joinToNode(stream(['a', undefined, 'b']), e => e && String(e), { separator: ',', appendNewLineIfNotEmpty: true, skipNewLineAfterLastItem: true})}
        `;
        const text = toString(node);
        expect(text).toBe(s`
            Data:
              a,
              b
        `);
    });
});

describe('Appending templates to existing nodes', () => {

    test('Append template to node', () => {
        const node = n`Prefix`.appendNewLine()
            .appendTemplate` some content: ${1}`.appendNewLineIfNotEmpty();
        const text = toString(node);
        expect(text).toBe(s`
            Prefix
             some content: 1
            
        `);
    });

    test('Conditionally append template to node', () => {
        const node = n`Prefix`.appendNewLine()
            .appendTemplateIf(!!0)` some content: ${0}`.appendNewLineIfNotEmpty()
            .appendTemplateIf(!!1)` some content: ${1}`.appendNewLineIfNotEmpty();
        const text = toString(node);
        expect(text).toBe(s`
            Prefix
             some content: 1
            
        `);
    });
});
