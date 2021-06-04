/* eslint-disable @typescript-eslint/no-explicit-any */
import * as ast from '../grammar-lang/generated/ast';
import { AstNode, CompositeCstNode, CstNode, ILeafCstNode, LeafCstNode } from '../generator/ast-node';
import { isDataTypeRule } from '../generator/utils';

export function serialize(grammar: ast.Grammar): string {
    return JSON.stringify(decycle(grammar, '$cstNode'));
}

export function deserialize(content: string): ast.Grammar {
    return <ast.Grammar>retrocycle(JSON.parse(content));
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

function decycle(object: Record<string, any>, ...ignore: string[]): any {
    const objectPaths = new Map<any, string>(); // Keep references to each unique object

    const replace = (item: Record<string, any>, path: string) => {
        // The replace function recurses through the object, producing the deep copy.
        if (typeof item === 'object' && item !== null) {
            // If the value is an object or array, look to see if we have already
            // encountered it. If so, return a $ref/path object.
            if (objectPaths.has(item)) {
                return { $ref: objectPaths.get(item) };
            }
            // Otherwise, accumulate the unique value and its path.
            objectPaths.set(item, path);
            let newItem: Record<string, any>;
            // If it is an array, replicate the array.
            if (Array.isArray(item)) {
                newItem = [];
                for (let i = 0; i < item.length; i++) {
                    newItem[i] = replace(item[i], path + '[' + i + ']');
                }
            } else {
                // If it is an object, replicate the object.
                newItem = {};
                for (const [name, itemValue] of Object.entries(item)) {
                    if (isPlainProperty(item, name) && !ignore.includes(name)) {
                        newItem[name] = replace(<any>itemValue, path + '[' + JSON.stringify(name) + ']');
                    }
                }
            }
            return newItem;
        }
        return item;
    };
    return replace(object, '$');
}

function isPlainProperty(object: Record<string, any>, propertyName: string) {
    const descriptor = Object.getOwnPropertyDescriptor(object, propertyName);
    if (descriptor !== undefined)
        return descriptor.get === undefined;
    return true;
}

// eslint-disable-next-line no-control-regex
const pathRegex = /^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\([\\"/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function retrocycle($: any): any {
    const revive = (value: Record<string, any>) => {

        // The revive function walks recursively through the object looking for $ref
        // properties. When it finds one that has a value that is a path, then it
        // replaces the $ref object with a reference to the value that is found by
        // the path.

        if (value && typeof value === 'object') {
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    const item = value[i];
                    if (item && typeof item === 'object') {
                        const path = item.$ref;
                        if (typeof path === 'string' && pathRegex.test(path)) {
                            // eslint-disable-next-line no-eval
                            value[i] = eval(path);
                        } else {
                            revive(item);
                        }
                    }
                }
            } else {
                for (const [name, item] of Object.entries(value)) {
                    if (typeof value[name] === 'object') {
                        if (item) {
                            const path = item.$ref;
                            if (typeof path === 'string' && pathRegex.test(path)) {
                                // eslint-disable-next-line no-eval
                                value[name] = eval(path);
                            } else {
                                revive(item);
                                if (item._ref) {
                                    // Special case for Reference
                                    Object.defineProperty(item, 'value', {
                                        get: () => item._ref
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    revive($);
    return $;
}
