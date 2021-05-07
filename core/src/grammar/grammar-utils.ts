/* eslint-disable @typescript-eslint/no-explicit-any */
import { AbstractRule, EnumRule, Grammar, ParserRule, TerminalRule } from '../gen/ast';
import { CompositeCstNode, CstNode, ILeafCstNode, LeafCstNode } from '../generator/ast-node';
import { isDataTypeRule } from '../generator/utils';

export function serialize(grammar: Grammar): string {
    return JSON.stringify(decycle(grammar, '$cstNode'));
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

export function decycle(object: Record<string, any>, ...ignore: string[]): any {
    const objectPaths = new Map<any, string>(); // Keep references to each unique object

    return (function replace(value, path): any {
        // The replace function recurses through the object, producing the deep copy.
        const item = value && value.toJSON instanceof Function ? value.toJSON() : value;
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
                    if (!ignore.includes(name)) {
                        newItem[name] = replace(<any>itemValue, path + '[' + JSON.stringify(name) + ']');
                    }
                }
            }
            return newItem;
        }
        return item;
    }(object, '$'));
}

// eslint-disable-next-line no-control-regex
const pathRegex = /^\$(?:\[(?:\d+|"(?:[^\\"\u0000-\u001f]|\\([\\"/bfnrt]|u[0-9a-zA-Z]{4}))*")\])*$/;

// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
export function retrocycle($: any): any {
    (function revive(value: Record<string, any>) {

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
                            }
                        }
                    }
                }
            }
        }
    }($));
    return $;
}