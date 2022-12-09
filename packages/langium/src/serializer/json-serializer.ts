/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { NameProvider } from '../references/name-provider';
import { LangiumServices } from '../services';
import { AstNode, GenericAstNode, isAstNode, isReference, Reference } from '../syntax-tree';
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
    $ref?: string
    $error?: string
}

function isIntermediateReference(obj: unknown): obj is IntermediateReference {
    return typeof obj === 'object' && !!obj && ('$ref' in obj || '$error' in obj);
}

export class DefaultJsonSerializer implements JsonSerializer {

    protected ignoreProperties = new Set(['$container', '$containerProperty', '$containerIndex', '$document', '$cstNode']);
    protected readonly astNodeLocator: AstNodeLocator;
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.astNodeLocator = services.workspace.AstNodeLocator;
        this.nameProvider = services.references.NameProvider;
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
            const $refText = refText ? value.$refText : undefined;
            if (refValue) {
                return {
                    $refText,
                    $ref: '#' + (refValue && this.astNodeLocator.getAstNodePath(refValue))
                };
            } else {
                return {
                    $refText,
                    $error: value.error?.message ?? 'Could not resolve reference'
                };
            }
        }
        return value;
    }

    protected linkNode(node: GenericAstNode, root: AstNode, container?: AstNode, containerProperty?: string, containerIndex?: number) {
        for (const [propertyName, item] of Object.entries(node)) {
            if (Array.isArray(item)) {
                for (let index = 0; index < item.length; index++) {
                    const element = item[index];
                    if (isIntermediateReference(element)) {
                        item[index] = this.reviveReference(node, propertyName, root, element);
                    } else if (isAstNode(element)) {
                        this.linkNode(element as GenericAstNode, root, node, propertyName, index);
                    }
                }
            } else if (isIntermediateReference(item)) {
                node[propertyName] = this.reviveReference(node, propertyName, root, item);
            } else if (isAstNode(item)) {
                this.linkNode(item as GenericAstNode, root, node, propertyName);
            }
        }
        const mutable = node as Mutable<GenericAstNode>;
        mutable.$container = container;
        mutable.$containerProperty = containerProperty;
        mutable.$containerIndex = containerIndex;
    }

    protected reviveReference(container: AstNode, property: string, root: AstNode, reference: IntermediateReference): Reference | undefined {
        let refText = reference.$refText;
        if (reference.$ref) {
            const ref = this.getRefNode(root, reference.$ref);
            if (!refText) {
                refText = this.nameProvider.getName(ref);
            }
            return {
                $refText: refText ?? '',
                ref
            };
        } else if (reference.$error) {
            const ref: Mutable<Reference> = {
                $refText: refText ?? ''
            };
            ref.error = {
                container,
                property,
                message: reference.$error,
                reference: ref
            };
            return ref;
        } else {
            return undefined;
        }
    }

    protected getRefNode(root: AstNode, path: string): AstNode {
        return this.astNodeLocator.getAstNode(root, path.substring(1))!;
    }
}
