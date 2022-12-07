/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumServices } from '../services';
import { AstNode, GenericAstNode, isAstNode, isReference } from '../syntax-tree';
import { Mutable } from '../utils/ast-util';
import { AstNodeLocator } from '../workspace/ast-node-locator';

export interface JsonSerializeOptions {
    space?: string | number
    refText?: boolean
}

/**
 * Utility service for transforming an `AstNode` into a JSON string and vice versa.
 */
export interface JsonSerializer {
    /**
     * Serialize an `AstNode` into a JSON `string`.
     * @param node The `AstNode` to be serialized.
     * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
     */
    serialize(node: AstNode, options?: JsonSerializeOptions): string;
    /**
     * Deserialize (parse) a JSON `string` into an `AstNode`.
     */
    deserialize(content: string): AstNode;
}

interface IntermediateReference {
    $refText?: string
    $ref: string
}

function isIntermediateReference(obj: unknown): obj is IntermediateReference {
    return typeof obj === 'object' && !!obj && '$ref' in obj;
}

export class DefaultJsonSerializer implements JsonSerializer {

    protected ignoreProperties = new Set(['$container', '$containerProperty', '$containerIndex', '$document', '$cstNode']);
    protected readonly astNodeLocator: AstNodeLocator;

    constructor(services: LangiumServices) {
        this.astNodeLocator = services.workspace.AstNodeLocator;
    }

    serialize(node: AstNode, options?: JsonSerializeOptions): string {
        return JSON.stringify(node, (key, value) => this.replacer(key, value, options?.refText), options?.space);
    }

    deserialize(content: string): AstNode {
        const root = JSON.parse(content);
        this.linkNode(root, root);
        return root;
    }

    protected replacer(key: string, value: unknown, refText?: boolean): unknown {
        if (this.ignoreProperties.has(key)) {
            return undefined;
        } else if (isReference(value)) {
            const refValue = value.ref;
            return {
                $refText: refText ? value.$refText : undefined,
                $ref: '#' + (refValue && this.astNodeLocator.getAstNodePath(refValue))
            };
        }
        return value;
    }

    protected decycle(object: AstNode, ignore: Set<string>): unknown {
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
                        if (!ignore.has(name)) {
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

    protected linkNode(node: GenericAstNode, root: AstNode, container?: AstNode, containerProperty?: string, containerIndex?: number) {
        for (const [propertyName, item] of Object.entries(node)) {
            if (Array.isArray(item)) {
                for (let index = 0; index < item.length; index++) {
                    const element = item[index];
                    if (isIntermediateReference(element)) {
                        item[index] = {
                            $refText: element.$refText ?? '',
                            ref: this.getRefNode(root, element.$ref),
                        };
                    } else if (isAstNode(element)) {
                        this.linkNode(element as GenericAstNode, root, node, propertyName, index);
                    }
                }
            } else if (isIntermediateReference(item)) {
                node[propertyName] = {
                    $refText: item.$refText ?? '',
                    ref: this.getRefNode(root, item.$ref),
                };
            } else if (isAstNode(item)) {
                this.linkNode(item as GenericAstNode, root, node, propertyName);
            }
        }
        const mutable = node as Mutable<GenericAstNode>;
        mutable.$container = container;
        mutable.$containerProperty = containerProperty;
        mutable.$containerIndex = containerIndex;
    }

    protected getRefNode(root: AstNode, path: string): AstNode {
        return this.astNodeLocator.getAstNode(root, path.substring(1))!;
    }
}
