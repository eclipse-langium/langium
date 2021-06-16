import { isRuleCall } from '../grammar/generated/ast';
import { CstNode } from '../syntax-tree';

export interface PrimitiveConverter {
    convert(input: string, cstNode: CstNode): string | number;
}

export type InputConverter = (input: string, cstNode: CstNode) => string | number;

export class DefaultPrimitiveConverter implements PrimitiveConverter {

    protected converters = new Map<string, InputConverter>();

    constructor() {
        this.convertFor('string', this.convertString);
        this.convertFor('ID', this.convertID);
    }

    convert(input: string, cstNode: CstNode): string | number {
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

    protected convertFor(ruleName: string, converter: InputConverter): void {
        this.converters.set(ruleName, converter);
    }

    protected runConverter(ruleName: string, input: string, cstNode: CstNode): string | number {
        const converter = this.converters.get(ruleName);
        if (converter) {
            return converter(input, cstNode);
        } else {
            return input;
        }
    }

    protected convertString(input: string): string {
        return input.substring(1, input.length - 1);
    }

    protected convertID(input: string): string {
        if (input.charAt(0) === '^') {
            return input.substring(1);
        } else {
            return input;
        }
    }
}