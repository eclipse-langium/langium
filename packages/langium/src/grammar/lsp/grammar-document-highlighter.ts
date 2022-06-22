/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DocumentHighlight, DocumentHighlightKind } from 'vscode-languageserver';
import { DefaultDocumentHighlighter } from '../../lsp/document-highlighter';
import { LangiumServices } from '../../services';
import { AstNode, CstNode, LeafCstNode } from '../../syntax-tree';
import { getContainerOfType, getDocument, streamAst } from '../../utils/ast-util';
import { findLeafNodeAtOffset } from '../../utils/cst-util';
import { equalURI } from '../../utils/uri-utils';
import { AstNodeLocator } from '../../workspace/ast-node-locator';
import { LangiumDocument, LangiumDocuments } from '../../workspace/documents';
import { Interface, isAssignment, isInterface, isParserRule, isTypeAttribute, ParserRule, Type } from '../generated/ast';
import { collectChildrenTypes } from '../type-system/types-util';

export class LangiumGrammarDocumentHighlighter extends DefaultDocumentHighlighter {

    readonly astNodeLocator: AstNodeLocator;
    readonly langiumDocuments: LangiumDocuments;

    constructor(services: LangiumServices) {
        super(services);
        this.astNodeLocator = services.workspace.AstNodeLocator;
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
    }

    protected getHighlights(selectedNode: LeafCstNode, document: LangiumDocument<AstNode>, rootNode: CstNode): DocumentHighlight[] | undefined {
        const targetAstNode = this.references.findDeclaration(selectedNode)?.element;
        if (targetAstNode) {
            const highlights: Array<[CstNode, DocumentHighlightKind]> = [];
            if (equalURI(getDocument(targetAstNode).uri), document.uri) {
                highlights.push([selectedNode, super.getHighlightKind(selectedNode)]);
            }
            if (isTypeAttribute(targetAstNode)) {
                const interfaces: Set<Interface | Type> = new Set<Interface | Type>();
                const interfaceNode = getContainerOfType(targetAstNode, isInterface);
                if (interfaceNode) {
                    interfaces.add(interfaceNode);
                }

                const childrenInterfaces = collectChildrenTypes(interfaceNode!, this.references, this.langiumDocuments, this.astNodeLocator);
                childrenInterfaces.forEach(child => interfaces.add(child));

                const parserRules: ParserRule[] = [];

                interfaces.forEach(i => {
                    const rules = streamAst(getDocument(targetAstNode).parseResult.value).filter(x => isParserRule(x) && x.returnType?.ref === i);
                    rules.forEach(rule => {
                        if (isParserRule(rule)) {
                            parserRules.push(rule);
                        }
                    });
                });

                parserRules.forEach(rule => {
                    if (isParserRule(rule)) {
                        const assignments = streamAst(rule).filter(x => isAssignment(x) && x.feature === selectedNode.text);
                        assignments.forEach(assignment => {
                            if (assignment.$cstNode) {
                                const leaf = findLeafNodeAtOffset(assignment.$cstNode, assignment.$cstNode.offset);
                                console.log(leaf);
                                if (leaf) {
                                    highlights.push([leaf, super.getHighlightKind(leaf)]);
                                }
                            }
                        });
                    }
                });
                return highlights.map(([node, kind]) => DocumentHighlight.create(node.range, kind));
            } else {
                return super.getHighlights(selectedNode, document, rootNode);
            }
        } else {
            const element = selectedNode.element;
            if (isAssignment(element)) {
                console.log('assignment');
            }
        }
        return undefined;
    }
}