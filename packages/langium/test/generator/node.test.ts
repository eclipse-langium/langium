/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EOL } from 'os';
import { processGeneratorNode as process, CompositeGeneratorNode, NL, NLEmpty, NewLineNode, IndentNode } from '../../src';

describe('new lines', () => {

    test('should create new line', () => {
        const result = process(NL);
        expect(result).toBe(EOL);
    });

    test('should split text into new lines', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('First', NL, 'Second');
        expect(process(comp)).toBe(`First${EOL}Second`);
    });

    test('should process with speicified line delimiter', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('First', new NewLineNode('/'), 'Second');
        expect(process(comp)).toBe('First/Second');
    });

    test('should not split text into new lines on previous empty line', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('', NLEmpty, 'Second');
        expect(process(comp)).toBe('Second');
    });

    test('should split text into new lines on previous empty line', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('First', NLEmpty, 'Second');
        expect(process(comp)).toBe(`First${EOL}Second`);
    });

    test('should create multiple new lines', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('First', NL, NL, 'Second');
        expect(process(comp)).toBe(`First${EOL}${EOL}Second`);
    });

    test('should not create multiple new lines on previous empty line', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('First', NL, NLEmpty, 'Second');
        expect(process(comp)).toBe(`First${EOL}Second`);
    });

});

describe('indentation', () => {

    test('should create indent node undefined indentation', () => {
        const node = new IndentNode();
        expect(node.indentation).toBe(undefined);
    });

    test('should create indent node with 2 spaces if specified', () => {
        const node = new IndentNode(2);
        expect(node.indentation).toBe('  ');
    });

    test('should create indent node with 2 spaces as string if specified', () => {
        const node = new IndentNode('  ');
        expect(node.indentation).toBe('  ');
    });

    test('should indent 4 spaces by default after new line', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('No indent', NL);
        comp.indent(node => {
            node.append('Indent');
        });
        expect(process(comp)).toBe(`No indent${EOL}    Indent`);
    });

    test('should indent 2 spaces if specified after new line', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('No indent', NL);
        comp.indent(node => {
            node.append('Indent');
        });
        expect(process(comp, 2)).toBe(`No indent${EOL}  Indent`);
    });

    test('should indent 2 spaces by default after new line if specified', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('No indent', NL);
        const indent = new IndentNode();
        indent.append('Indent');
        comp.append(indent);
        indent.indentation = '  ';
        expect(process(comp)).toBe(`No indent${EOL}  Indent`);
    });

    test('should de-indent correctly after indentation', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('No indent', NL);
        comp.indent(node => {
            node.append('Indent', NL);
        });
        comp.append('No indent');
        expect(process(comp)).toBe(`No indent${EOL}    Indent${EOL}No indent`);
    });

    test('should indent with multiple lines', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('No indent', NL);
        comp.indent(node => {
            node.append('Indent', NL, 'Indent');
        });
        expect(process(comp, ' ')).toBe(`No indent${EOL} Indent${EOL} Indent`);
    });

});

describe('composite', () => {

    test('should append default', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('Some ', 'text');
        expect(process(comp)).toBe('Some text');
    });

    test('should append with generator function', () => {
        const comp = new CompositeGeneratorNode();
        comp.append('Some ', node => node.append('more'), ' text');
        expect(process(comp)).toBe('Some more text');
    });

    test('should indent without function argument', () => {
        const indent = new IndentNode();
        const comp = new CompositeGeneratorNode(indent);
        indent.append('Indent');
        expect(process(comp)).toBe('    Indent');
    });

});