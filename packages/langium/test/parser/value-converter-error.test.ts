/******************************************************************************
 * Copyright 2025 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { ValueType, CstNode, ValueConverterError } from 'langium';
import { DefaultValueConverter, GrammarAST } from 'langium';
import { createServicesForGrammar } from 'langium/grammar';
import { validationHelper } from 'langium/test';
import { describe, expect, test } from 'vitest';

class CustomValueConverter extends DefaultValueConverter {
    override convert(input: string, cstNode: CstNode): ValueType | ValueConverterError {
        const grammarSource = cstNode.grammarSource;
        if (GrammarAST.isRuleCall(grammarSource) && grammarSource.rule.ref?.name === 'INT') {
            const num = parseInt(input);
            if (num < 0) {
                return {
                    message: 'Negative numbers are not allowed',
                    cstNode
                };
            }
            return num;
        }
        return super.convert(input, cstNode);
    }
}

describe('ValueConverterError', () => {
    const grammar = `
        grammar TestGrammar
        
        entry Model:
            value=INT;
        
        terminal INT returns number: /[+-]?[0-9]+/;
        hidden terminal WS: /\\s+/;
    `;

    test('should return error for negative numbers', async () => {
        const services = await createServicesForGrammar({
            grammar,
            module: {
                parser: {
                    ValueConverter: () => new CustomValueConverter()
                }
            }
        });
        const validate = validationHelper(services);

        const result = await validate('-42');
        expect(result.diagnostics).toHaveLength(1);
        expect(result.diagnostics[0].message).toBe('Negative numbers are not allowed');
        expect(result.diagnostics[0].severity).toBe(1); // error severity

        const validResult = await validate('42');
        expect(validResult.diagnostics).toHaveLength(0);
    });
});
