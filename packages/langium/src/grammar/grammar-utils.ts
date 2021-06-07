/* eslint-disable @typescript-eslint/no-explicit-any */
import * as ast from '../grammar-lang/generated/ast';
import { AstNode, CompositeCstNode, CstNode, ILeafCstNode, LeafCstNode } from '../generator/ast-node';
import { isDataTypeRule } from '../generator/utils';

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

export function findNodeForFeature(node: CstNode | undefined, feature: string | undefined, index?: number): CstNode | undefined {
    const nodes = findNodesForFeature(node, feature);
    if (nodes.length === 0) {
        return undefined;
    }
    if (index !== undefined) {
        index = Math.max(0, Math.min(index, nodes.length - 1));
    } else {
        index = 0;
    }
    return nodes[index];
}

/**
 * This `internal` declared method exists, as we want to find the first child with the specified feature.
 * When the own feature is named the same by accident, we will instead return the input value.
 * Therefore, we skip the first assignment check.
 * @param node The node to traverse/check for the specified feature
 * @param feature The specified feature to find
 * @param element The element of the initial node. Do not process nodes of other elements.
 * @param first Whether this is the first node of the whole check.
 * @returns A list of all nodes within this node that belong to the specified feature.
 */
function findNodesForFeatureInternal(node: CstNode | undefined, feature: string | undefined, element: AstNode | undefined, first: boolean): CstNode[] {
    if (!node || !feature || node.element !== element) {
        return [];
    }
    const nodeFeature = <ast.Assignment>AstNode.getContainer(node.feature, ast.reflection, ast.Assignment);
    if (!first && nodeFeature && nodeFeature.feature === feature) {
        return [node];
    } else if (node instanceof CompositeCstNode) {
        return node.children.flatMap(e => findNodesForFeatureInternal(e, feature, element, false));
    }
    return [];
}

export function findNodesForFeature(node: CstNode | undefined, feature: string | undefined): CstNode[] {
    return findNodesForFeatureInternal(node, feature, node?.element, true);
}

export function getTypeName(rule: ast.AbstractRule | undefined): string {
    if (ast.isEnumRule(rule)) {
        return rule.name;
    } else if (ast.isTerminalRule(rule) || ast.isParserRule(rule)) {
        return rule.type ?? rule.name;
    } else {
        throw new Error('Unknown rule type');
    }
}

export function getRuleType(rule: ast.AbstractRule | undefined): string {
    if (ast.isParserRule(rule) && isDataTypeRule(rule) || ast.isTerminalRule(rule)) {
        return rule.type ?? 'string';
    }
    return getTypeName(rule);
}
