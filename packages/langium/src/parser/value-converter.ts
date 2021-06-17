/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { isRuleCall } from '../grammar/generated/ast';
import { CstNode } from '../syntax-tree';

export interface ValueConverterRegistry {
    convert(input: string, cstNode: CstNode): unknown;
}

export type ValueType = string | number | boolean | Date;
export type ValueConverter = (input: string, cstNode: CstNode) => ValueType;

export class DefaultValueConverterRegistry implements ValueConverterRegistry {

    protected converters = new Map<string, ValueConverter>();

    constructor() {
        this.convertFor('string', convertString);
        this.convertFor('ID', convertID);
    }

    convert(input: string, cstNode: CstNode): ValueType {
        if (isRuleCall(cstNode.feature)) {
            const rule = cstNode.feature.rule.ref;
            if (!rule) {
                throw new Error('This cst node was not parsed by a rule.');
            }
            return this.runConverter(rule.name, input, cstNode);
        } else {
            return input;
        }
    }

    protected convertFor(ruleName: string, converter: ValueConverter): void {
        this.converters.set(ruleName, converter);
    }

    protected runConverter(ruleName: string, input: string, cstNode: CstNode): ValueType {
        const converter = this.converters.get(ruleName);
        if (converter) {
            return converter(input, cstNode);
        } else {
            return input;
        }
    }
}

export function convertString(input: string): string {
    return input.substring(1, input.length - 1);
}

export function convertID(input: string): string {
    if (input.charAt(0) === '^') {
        return input.substring(1);
    } else {
        return input;
    }
}