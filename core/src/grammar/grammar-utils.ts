import { AbstractRule, EnumRule, Grammar, ParserRule, TerminalRule } from '../gen/ast';
import { decycle, retrocycle } from 'json-cycle';
import { CompositeCstNode, CstNode, ILeafCstNode, LeafCstNode } from '../generator/ast-node';
import { isDataTypeRule } from '../generator/utils';

export function serialize(grammar: Grammar): string {
    return JSON.stringify(decycle(grammar));
}

export function deserialize(content: string): Grammar {
    return <Grammar>retrocycle(JSON.parse(content));
}

export function findLeafNodeAtOffset(node: CstNode, offset: number): ILeafCstNode | undefined {
    if (node instanceof LeafCstNode) {
        return node;
    } else if (node instanceof CompositeCstNode) {
        const children = node.children.filter(e => e.offset < offset).reverse();
        for (const child of children) {
            const result = findLeafNodeAtOffset(child, offset);
            if (result) {
                return result;
            }
        }
    }
    return undefined;
}

export function getTypeName(rule: AbstractRule | undefined): string {
    if (EnumRule.is(rule)) {
        return rule.name;
    } else if (TerminalRule.is(rule) || ParserRule.is(rule)) {
        return rule.type ?? rule.name;
    } else {
        throw new Error('Unknown rule type');
    }
}

export function getRuleType(rule: AbstractRule | undefined): string {
    if (ParserRule.is(rule) && isDataTypeRule(rule) || TerminalRule.is(rule)) {
        return rule.type ?? 'string';
    }
    return getTypeName(rule);
}
