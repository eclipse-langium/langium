/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AstNode, Reference } from '../syntax-tree';
import { Linker } from '../references/linker';
import { LangiumServices } from '../services';
import { isAstNode, isReference } from '../utils/ast-util';

/**
 * Utility service for transforming an `AstNode` into a JSON string and vice versa.
 */
export interface JsonSerializer {
    /**
     * Serialize an `AstNode` into a JSON `string`.
     * @param node The `AstNode` to be serialized.
     * @param space Adds indentation, white space, and line break characters to the return-value JSON text to make it easier to read.
     */
    serialize(node: AstNode, space?: string | number): string
    /**
     * Deserialize (parse) a JSON `string` into an `AstNode`.
     */
    deserialize(content: string): AstNode
}

export class DefaultJsonSerializer implements JsonSerializer {

    private readonly linker: Linker;
    protected ignoreProperties = ['$container', '$containerProperty', '$containerIndex', '$document', '$cstNode'];

    constructor(services: LangiumServices) {
        this.linker = services.references.Linker;
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
                // If it is a reference, just return the name
                if (isReference(item)) {
                    return { $refText: item.$refText } as Reference; // surprisingly this cast works at the time of writing, although $refNode is absent
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
        return replace(object);
    }

    protected revive(object: AstNode): AstNode {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const internalRevive = (value: Record<string, any>, container?: unknown, propName?: string) => {
            if (Array.isArray(value)) {
                // eslint-disable-next-line @typescript-eslint/prefer-for-of
                for (let i = 0; i < value.length; i++) {
                    const item = value[i];
                    if (isReference(item) && isAstNode(container)) {
                        const reference = this.linker.buildReference(container, propName!, item.$refNode, item.$refText);
                        value[i] = reference;
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
                        if (isReference(item)) {
                            const reference = this.linker.buildReference(value as AstNode, name, item.$refNode, item.$refText);
                            value[name] = reference;
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
        internalRevive(object);
        return object;
    }
}
