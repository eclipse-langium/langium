/******************************************************************************
* Copyright 2021 TypeFox GmbH
* This program and the accompanying materials are made available under the
* terms of the MIT License, which is available in the project root.
******************************************************************************/

import { DocumentHighlight } from 'vscode-languageserver';
import { DefaultDocumentHighlighter } from '../../lsp/document-highlighter';
import { LangiumServices } from '../../services';
import { AstNode, CstNode, LeafCstNode } from '../../syntax-tree';
import { extractRootNode, getContainerOfType, getDocument, getLocalParserRulesAndActionsWithReturnType, streamAst } from '../../utils/ast-util';
import { findLeafNodeAtOffset } from '../../utils/cst-util';
import { equalURI } from '../../utils/uri-utils';
import { AstNodeLocator } from '../../workspace/ast-node-locator';
import { LangiumDocument, LangiumDocuments } from '../../workspace/documents';
import { Action, Assignment, Interface, isAction, isAssignment, isGroup, isInterface, isParserRule, isTypeAttribute, ParserRule, Type, TypeAttribute } from '../generated/ast';
import { collectChildrenTypes, collectSuperTypes, findAttributeLeafNodeInInterface } from '../type-system/types-util';

export class LangiumGrammarDocumentHighlighter extends DefaultDocumentHighlighter {

    readonly astNodeLocator: AstNodeLocator;
    readonly langiumDocuments: LangiumDocuments;

    constructor(services: LangiumServices) {
        super(services);
        this.astNodeLocator = services.workspace.AstNodeLocator;
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
    }

    protected getHighlights(selectedNode: LeafCstNode, document: LangiumDocument<AstNode>, rootNode: CstNode): DocumentHighlight[] | undefined {
        const highlights: DocumentHighlight[] = [];
        const targetAstNode = this.references.findDeclaration(selectedNode)?.element;
        if (targetAstNode) {
            if (equalURI(getDocument(targetAstNode).uri), document.uri) {
                const highlight = DocumentHighlight.create(selectedNode.range, super.getHighlightKind(selectedNode));
                highlights.push(highlight);
            }
            if (isTypeAttribute(targetAstNode)) {
                highlights.push(...this.getHighlightsFromTypeAttribute(targetAstNode, selectedNode));
                return highlights;
            } else {
                return super.getHighlights(selectedNode, document, rootNode);
            }
        } else {
            const element = selectedNode.element;
            if (isAssignment(element)) {
                highlights.push(...this.getHighlightsFromAssignment(element, selectedNode));
                return highlights;
            }
        }
        return undefined;
    }

    protected getHighlightsFromTypeAttribute(typeAttribute: TypeAttribute, selectedNode: LeafCstNode): DocumentHighlight[] {
        const highlights: DocumentHighlight[] = [];
        const interfaceNode = getContainerOfType(typeAttribute, isInterface);
        const document = extractRootNode(typeAttribute)!.$document!;
        const interfaces = collectChildrenTypes(interfaceNode!, this.references, this.langiumDocuments, this.astNodeLocator);
        const targetRules: Array<ParserRule | Action>= [];
        interfaces.forEach(interf => {
            const rules = getLocalParserRulesAndActionsWithReturnType(document, interf);
            targetRules.push(...rules);
        });
        targetRules.forEach(rule => {
            const ruleNode = isAction(rule) ? getContainerOfType(rule, isGroup) : rule;
            if (ruleNode) {
                const highlight = this.getHighlightForAssignment(ruleNode, selectedNode);
                if (highlight) {
                    highlights.push(highlight);
                }
            }
        });
        return highlights;
    }

    protected getHighlightsFromAssignment(element: Assignment, selectedNode: LeafCstNode): DocumentHighlight[] {
        const highlights: DocumentHighlight[] = [];
        const rootNode = extractRootNode(element);
        const document = rootNode!.$document;
        const parserRule = getContainerOfType(element, isParserRule);
        const groupNode = getContainerOfType(element, isGroup);
        const targetInterfaces: Interface[] = [];
        if (parserRule?.returnType?.ref) {
            targetInterfaces.push(...collectSuperTypes(parserRule.returnType.ref as Interface | Type));
        }
        if (groupNode) {
            const action = groupNode.elements.find(el => isAction(el)) as Action | undefined;
            if (action?.type?.ref) {
                targetInterfaces.push(...collectSuperTypes(action.type.ref as Interface | Type));
            }
        }
        for (const interf of targetInterfaces) {
            const typeAttribute = findAttributeLeafNodeInInterface(interf, selectedNode.text);
            if (typeAttribute) {
                const partialHighlights = this.getHighlights(typeAttribute, document!, rootNode!.$cstNode!);
                if (partialHighlights) {
                    highlights.push(...partialHighlights);
                }
                break;
            }
        }
        return highlights;
    }

    protected getHighlightForAssignment(rule: AstNode, selectedNode: LeafCstNode): DocumentHighlight | undefined {
        const assignment = streamAst(rule).find(node => isAssignment(node) && node.feature === selectedNode.text);
        if (isAssignment(assignment)) {
            if (assignment.$cstNode) {
                const leaf = findLeafNodeAtOffset(assignment.$cstNode, assignment.$cstNode.offset);
                if (leaf) {
                    return DocumentHighlight.create(leaf.range, super.getHighlightKind(leaf));
                }
            }
        }
        return undefined;
    }
}
