/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices } from '../services';
import { AstNode, isAstNode, isReference } from '../syntax-tree';
import { AstNodeLocator } from '../workspace/ast-node-locator';

/**
 * Utility service for transforming an `AstNode` into a JSON string and vice versa.
 */
export interface JsonSerializer {
    /**
     * Serialize an `AstNode` into a JSON `string`.
     * @param node The `AstNode` to be serialized.
     * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
     */
    serialize(node: AstNode, space?: string | number): string;
    /**
     * Deserialize (parse) a JSON `string` into an `AstNode`.
     */
    deserialize(content: string): AstNode;
}

interface IntermediateReference {
    $ref: string
}

function isIntermediateReference(obj: unknown): obj is IntermediateReference {
    return typeof obj === 'object' && !!obj && '$ref' in obj;
}

export class DefaultJsonSerializer implements JsonSerializer {

    protected ignoreProperties = ['$container', '$containerProperty', '$containerIndex', '$document', '$cstNode'];
    protected readonly astNodeLocator: AstNodeLocator;

    constructor(services: LangiumServices) {
        this.astNodeLocator = services.workspace.AstNodeLocator;
    }

    serialize(node: AstNode, space?: string | number): string {
        return JSON.stringify(this.decycle(node, this.ignoreProperties), undefined, space);
    }

    deserialize(content: string): AstNode {
        return this.revive(JSON.parse(content));
    }

    protected decycle(object: AstNode, ignore: string[]): unknown {
        const objects = new Set<unknown>(); // Keep references to each unique object

        const replace = (item: unknown) => {
            // The replace function recurses through the object, producing the deep copy.
            if (typeof item === 'object' && item !== null) {
                if (objects.has(item)) {
                    throw new Error('Cycle in ast detected.');
                } else {
                    objects.add(item);
                }
                // If it is a reference, transform it into a path
                if (isReference(item)) {
                    const refValue = item.ref;
                    return {
                        $ref: refValue && this.astNodeLocator.getAstNodePath(refValue)
                    };
                }
                let newItem: Record<string, unknown> | unknown[];
                // If it is an array, replicate the array.
                if (Array.isArray(item)) {
                    newItem = [];
                    for (let i = 0; i < item.length; i++) {
                        newItem[i] = replace(item[i]);
                    }
                } else {
                    // If it is an object, replicate the object.
                    newItem = {};
                    for (const [name, itemValue] of Object.entries(item)) {
                        if (!ignore.includes(name)) {
                            newItem[name] = replace(itemValue);
                        }
                    }
                }
                return newItem;
            }
            return item;
        };
        const result = replace(object);
        return result;
    }

    protected revive(root: AstNode): AstNode {
        const pathActions: Array<() => void> = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const internalRevive = (value: Record<string, any>, container?: unknown, propName?: string) => {
            if (Array.isArray(value)) {
                for (let i = 0; i < value.length; i++) {
                    const item = value[i];
                    if (isIntermediateReference(item) && isAstNode(container)) {
                        const index = i;
                        pathActions.push(() => {
                            const ref = this.evalRef(root, item.$ref);
                            value[index] = { ref, $refText: '' };
                        });
                    } else if (typeof item === 'object' && item !== null) {
                        internalRevive(item);
                        item.$container = container;
                        item.$containerProperty = propName;
                        item.$containerIndex = i;
                    }
                }
            } else if (typeof value === 'object' && value !== null) {
                for (const [name, item] of Object.entries(value)) {
                    if (typeof item === 'object' && item !== null) {
                        if (isIntermediateReference(item)) {
                            pathActions.push(() => {
                                const ref = this.evalRef(root, item.$ref);
                                value[name] = { ref, $refText: '' };
                            });
                        } else if (Array.isArray(item)) {
                            internalRevive(item, value, name);
                        } else {
                            internalRevive(item);
                            item.$container = value;
                            item.$containerProperty = name;
                        }
                    }
                }
            }
        };
        internalRevive(root);
        pathActions.forEach(e => e());
        return root;
    }

    protected evalRef(root: AstNode, path: string): AstNode {
        return this.astNodeLocator.getAstNode(root, path)!;
    }
}
