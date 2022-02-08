/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { TokenType } from 'chevrotain';
import type { URI } from 'vscode-uri';
import type { AbstractElement } from './grammar/generated/ast';
import type { DocumentSegment, LangiumDocument } from './workspace/documents';

/**
 * A node in the Abstract Syntax Tree (AST).
 */
export interface AstNode {
    /** Every AST node has a type corresponding to what was specified in the grammar declaration. */
    readonly $type: string;
    /** The container node in the AST; every node except the root node has a container. */
    readonly $container?: AstNode;
    /** The property of the `$container` node that contains this node. This is either a direct reference or an array. */
    readonly $containerProperty?: string;
    /** In case `$containerProperty` is an array, the array index is stored here. */
    readonly $containerIndex?: number;
    /** The Concrete Syntax Tree (CST) node of the text range from which this node was parsed. */
    readonly $cstNode?: CstNode;
    /** The document containing the AST; only the root node has a direct reference to the document. */
    readonly $document?: LangiumDocument;
}

/**
 * The property names of a given AST node type.
 */
export type Properties<N extends AstNode> = keyof Omit<N, keyof AstNode | number | symbol>

/**
 * A cross-reference in the AST. Cross-references may or may not be successfully resolved.
 */
export interface Reference<T extends AstNode = AstNode> {
    /**
     * The target AST node of this reference. Accessing this property may trigger cross-reference
     * resolution by the `Linker` in case it has not been done yet. If the reference cannot be resolved,
     * the value is `undefined`.
     */
    readonly ref?: T;

    /** If any problem occurred while resolving the reference, it is described by this property. */
    readonly error?: LinkingError;
    /** The CST node from which the reference was parsed */
    readonly $refNode: CstNode;
    /** The actual text used to look up in the surrounding scope */
    readonly $refText: string;
    /** The node description for the AstNode returned by `ref`  */
    readonly $nodeDescription?: AstNodeDescription;
}

/**
 * A description of an AST node is used when constructing scopes and looking up cross-reference targets.
 */
export interface AstNodeDescription {
    /** The target node; should be present only for local references (linking to the same document). */
    node?: AstNode;
    /** `$type` property value of the AST node */
    type: string;
    /** Name of the AST node; this is usually determined by the `NameProvider` service. */
    name: string;
    /** URI to the document containing the AST node */
    documentUri: URI;
    /** Navigation path inside the document */
    path: string;
}

/**
 * Information about a cross-reference. This is used when traversing references in an AST or to describe
 * unresolved references.
 */
export interface ReferenceInfo {
    reference: Reference
    container: AstNode
    property: string
    index?: number
}

/**
 * Used to collect information when the `Linker` service fails to resolve a cross-reference.
 */
export interface LinkingError extends ReferenceInfo {
    message: string;
    targetDescription?: AstNodeDescription;
}

/**
 * Service used for generic access to the structure of the AST. This service is shared between
 * all involved languages, so it operates on the superset of types of these languages.
 */
export interface AstReflection {
    getAllTypes(): string[]
    getReferenceType(referenceId: string): string
    isInstance(node: AstNode, type: string): boolean
    isSubtype(subtype: string, supertype: string): boolean
}

/**
 * A node in the Concrete Syntax Tree (CST).
 */
export interface CstNode extends DocumentSegment {
    /** The container node in the CST */
    readonly parent?: CompositeCstNode;
    /** The actual text */
    readonly text: string;
    /** The root CST node */
    readonly root: CompositeCstNode;
    /** The grammar element from which this node was parsed */
    readonly feature: AbstractElement;
    /** The AST node created from this CST node */
    readonly element: AstNode;
    /** Whether the token is hidden, i.e. not explicitly part of the containing grammar rule */
    readonly hidden: boolean;
}

/**
 * Text range for the CST.
 */
export interface CstRange {
    /** Start offset in the document text */
    start: number;
    /** End offset (exclusive) in the document text */
    end: number;
}

/**
 * A composite CST node has children, but no directly associated token.
 */
export interface CompositeCstNode extends CstNode {
    children: CstNode[];
}

/**
 * A leaf CST node corresponds to a token in the input token stream.
 */
export interface LeafCstNode extends CstNode {
    readonly tokenType: TokenType;
}
