/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { NameProvider } from '../references/name-provider';
import type { LangiumServices } from '../services';
import type { AstNode, CstNode, GenericAstNode, Reference } from '../syntax-tree';
import type { Mutable } from '../utils/ast-util';
import type { AstNodeLocator } from '../workspace/ast-node-locator';
import type { DocumentSegment } from '../workspace/documents';
import { isAstNode, isReference } from '../syntax-tree';
import { getDocument } from '../utils/ast-util';
import { findNodesForProperty } from '../utils/grammar-util';
import type { CommentProvider } from '../documentation/comment-provider';

export interface JsonSerializeOptions {
    space?: string | number;
    refText?: boolean;
    sourceText?: boolean;
    textRegions?: boolean;
    comments?: boolean;
    replacer?: (key: string, value: unknown, defaultReplacer: (key: string, value: unknown) => unknown) => unknown
}

/**
 * {@link AstNode}s that may carry information on their definition area within the DSL text.
 */
export interface AstNodeWithTextRegion extends AstNode {
    $sourceText?: string;
    $textRegion?: AstNodeRegionWithAssignments;
}

/**
 * {@link AstNode}s that may carry a comment CST node in front of itself.
 */
export interface AstNodeWithComment extends AstNode {
    $comment?: string;
}

/**
 * A {@DocumentSegment} representing the definition area of an AstNode within the DSL text.
 * Usually contains text region information on all assigned property values of the AstNode,
 * and may contain the defining file's URI as string.
 */
export interface AstNodeRegionWithAssignments extends DocumentSegment {
    /**
     * A record containing an entry for each assignd property of the AstNode.
     * The key is equal to the property name and the value is an array of the property values'
     * text regions, regardless of whether the property is a single value or list property.
     */
    assignments?: Record<string, DocumentSegment[]>;
    /**
     * The AstNode defining file's URI as string
     */
    documentURI?: string;
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
    protected readonly commentProvider: CommentProvider;

    constructor(services: LangiumServices) {
        this.astNodeLocator = services.workspace.AstNodeLocator;
        this.nameProvider = services.references.NameProvider;
        this.commentProvider = services.documentation.CommentProvider;
    }

    serialize(node: AstNode, options?: JsonSerializeOptions): string {
        const specificReplacer = options?.replacer;
        const defaultReplacer = (key: string, value: unknown) => this.replacer(key, value, options);
        const replacer = specificReplacer ? (key: string, value: unknown) => specificReplacer(key, value, defaultReplacer) : defaultReplacer;

        return JSON.stringify(node, replacer, options?.space);
    }

    deserialize(content: string): AstNode {
        const root = JSON.parse(content);
        this.linkNode(root, root);
        return root;
    }

    protected replacer(key: string, value: unknown, { refText, sourceText, textRegions, comments }: JsonSerializeOptions = {}): unknown {
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
        } else {
            let astNode: AstNodeWithTextRegion | undefined = undefined;
            if (textRegions && isAstNode(value)) {
                astNode = this.addAstNodeRegionWithAssignmentsTo({ ...value });
                if ((!key || value.$document) && astNode?.$textRegion) {
                    try {
                        astNode.$textRegion.documentURI = getDocument(value).uri.toString();
                    } catch (e) { /* do nothing */ }
                }
            }
            if (sourceText && !key && isAstNode(value)) {
                astNode ??= { ...value };
                astNode.$sourceText = value.$cstNode?.text;
            }
            if (comments && isAstNode(value)) {
                astNode ??= {
                    ...value,
                    $comment: this.commentProvider.getComment(value)
                } as AstNodeWithComment;
            }
            return astNode ?? value;
        }
    }

    protected addAstNodeRegionWithAssignmentsTo(node: AstNodeWithTextRegion) {
        const createDocumentSegment: (cstNode: CstNode) => AstNodeRegionWithAssignments = cstNode => <DocumentSegment>{
            offset: cstNode.offset,
            end: cstNode.end,
            length: cstNode.length,
            range: cstNode.range,
        };

        if (node.$cstNode) {
            const textRegion = node.$textRegion = createDocumentSegment(node.$cstNode);
            const assignments: Record<string, DocumentSegment[]> = textRegion.assignments = {};

            Object.keys(node).filter(key => !key.startsWith('$')).forEach(key => {
                const propertyAssignments = findNodesForProperty(node.$cstNode, key).map(createDocumentSegment);
                if (propertyAssignments.length !== 0) {
                    assignments[key] = propertyAssignments;
                }
            });

            return node;
        }
        return undefined;
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
