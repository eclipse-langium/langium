/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AbstractElement, AbstractRule, isCrossReference, isRuleCall } from '../grammar/generated/ast';
import { getRuleType } from '../grammar/internal-grammar-util';
import { CstNode } from '../syntax-tree';
import { getCrossReferenceTerminal } from '../utils/grammar-util';

/**
 * Language-specific service for converting string values from the source text format into a value to be held in the AST.
 */
export interface ValueConverter {
    /**
     * Converts a string value from the source text format into a value to be held in the AST.
     */
    convert(input: string, cstNode: CstNode): ValueType;
}

export type ValueType = string | number | boolean | bigint | Date;

export class DefaultValueConverter implements ValueConverter {

    convert(input: string, cstNode: CstNode): ValueType {
        let feature: AbstractElement | undefined = cstNode.feature;
        if (isCrossReference(feature)) {
            feature = getCrossReferenceTerminal(feature);
        }
        if (isRuleCall(feature)) {
            const rule = feature.rule.ref;
            if (!rule) {
                throw new Error('This cst node was not parsed by a rule.');
            }
            return this.runConverter(rule, input, cstNode);
        }
        return input;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    protected runConverter(rule: AbstractRule, input: string, cstNode: CstNode): ValueType {
        switch (rule.name.toUpperCase()) {
            case 'INT': return convertInt(input);
            case 'STRING': return convertString(input);
            case 'ID': return convertID(input);
            case 'REGEXLITERAL': return convertString(input);
        }
        switch (getRuleType(rule)?.toLowerCase()) {
            case 'number': return convertNumber(input);
            case 'boolean': return convertBoolean(input);
            case 'bigint': return convertBigint(input);
            case 'date': return convertDate(input);
            default: return input;
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

export function convertInt(input: string): number {
    return parseInt(input);
}

export function convertBigint(input: string): bigint {
    return BigInt(input);
}

export function convertDate(input: string): Date {
    return new Date(input);
}

export function convertNumber(input: string): number {
    return Number(input);
}

export function convertBoolean(input: string): boolean {
    return input.toLowerCase() === 'true';
}
