/******************************************************************************
* Copyright 2021 TypeFox GmbH
* This program and the accompanying materials are made available under the
* terms of the MIT License, which is available in the project root.
******************************************************************************/

import { Location, ReferenceParams } from 'vscode-languageserver';
import { DefaultReferenceFinder } from '../../lsp';
import { References } from '../../references/references';
import { LangiumServices } from '../../services';
import { AstNode, LeafCstNode } from '../../syntax-tree';
import { extractAssignments, extractRootNode, getContainerOfType } from '../../utils/ast-util';
import { findLeafNodeAtOffset } from '../../utils/cst-util';
import { AstNodeLocator } from '../../workspace/ast-node-locator';
import { LangiumDocument, LangiumDocuments } from '../../workspace/documents';
import { Action, Assignment, Interface, isAction, isAssignment, isGroup, isInterface, isParserRule, isTypeAttribute, ParserRule, Type, TypeAttribute } from '../generated/ast';
import { collectChildrenTypes, collectSuperTypes, findAttributeLeafNodeInInterface } from '../type-system/types-util';

export class LangiumGrammarReferenceFinder extends DefaultReferenceFinder {
    readonly astNodeLocator: AstNodeLocator;
    readonly langiumDocuments: LangiumDocuments;

    constructor(services: LangiumServices) {
        super(services);
        this.astNodeLocator = services.workspace.AstNodeLocator;
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
    }

    protected getReferences(selectedNode: LeafCstNode, params: ReferenceParams, document: LangiumDocument<AstNode>): Location[] {
        const refs: Location[] = [];
        const targetAstNode = selectedNode.element;

        if (isTypeAttribute(targetAstNode)) {
            refs.push(...this.getReferencesFromTypeAttribute(targetAstNode, selectedNode));
            if (params.context.includeDeclaration) {
                const leafNode = findLeafNodeAtOffset(selectedNode, selectedNode.offset);
                refs.push(Location.create(document.uri.toString(), leafNode!.range));
            }
        } else if (isAssignment(targetAstNode)) {
            refs.push(...this.getReferencesFromAssignment(targetAstNode, selectedNode, params, document));
        } else {
            refs.push(...super.getReferences(selectedNode, params, document));
        }

        return refs;
    }

    getReferencesFromAssignment(targetAstNode: Assignment, selectedNode: LeafCstNode, params: ReferenceParams, document: LangiumDocument<AstNode>): Location[] {
        const refs: Location[] = [];
        const parserRule = getContainerOfType(targetAstNode, isParserRule);
        const groupNode = getContainerOfType(targetAstNode, isGroup);
        const interfaces: Interface[] = [];

        if (parserRule?.returnType?.ref) {
            interfaces.push(...collectSuperTypes(parserRule.returnType.ref as Interface | Type));
        }
        if (groupNode) {
            const action = groupNode.elements.find(el => isAction(el)) as Action | undefined;
            if (action?.type?.ref) {
                interfaces.push(...collectSuperTypes(action.type.ref as Interface | Type));
            }
        }
        for (const interf of interfaces) {
            const leaf = findAttributeLeafNodeInInterface(interf, selectedNode.text);
            if (leaf) {
                refs.push(...this.getReferences(leaf, params, document));
                break;
            }
        }
        return refs;
    }

    getReferencesFromTypeAttribute(typeAttributeNode: TypeAttribute, selectedNode: LeafCstNode): Location[] {
        const refs: Location[] = [];
        const interfaceNode = getContainerOfType(typeAttributeNode, isInterface);
        if (interfaceNode) {
            const interfaces = collectChildrenTypes(interfaceNode, this.references, this.langiumDocuments, this.astNodeLocator);

            const targetRules: Array<ParserRule | Action> = [];
            interfaces.forEach(interf => {
                targetRules.push(...getParserRulesAndActionsWithReturnType(interf, this.references, this.langiumDocuments, this.astNodeLocator));
            });

            targetRules.forEach(rule => {
                const assignment = isParserRule(rule) ?
                    extractAssignments(rule.definition).find(assignment => assignment.feature === selectedNode.text) :
                    extractAssignments(getContainerOfType(rule, isGroup)!).find(assignment => assignment.feature === selectedNode.text);

                if (assignment) {
                    const location = getLocationOfAssignment(assignment);
                    if (location) {
                        refs.push(location);
                    }
                }
            });
        }
        return refs;
    }
}

function getParserRulesAndActionsWithReturnType(returnType: Interface | Type, references: References, langiumDocuments: LangiumDocuments, astNodeLocator: AstNodeLocator): Array<ParserRule | Action> {
    const rules: Array<ParserRule |  Action> = [];
    const refs = references.findReferences(returnType);
    refs.forEach(ref => {
        const doc = langiumDocuments.getOrCreateDocument(ref.sourceUri);
        const astNode = astNodeLocator.getAstNode(doc, ref.sourcePath);
        if (isParserRule(astNode) || isAction(astNode)) {
            rules.push(astNode);
        }
    });
    return rules;
}

function getLocationOfAssignment(assignment: Assignment): Location | undefined {
    if (assignment.$cstNode) {
        const leaf = findLeafNodeAtOffset(assignment.$cstNode, assignment.$cstNode.offset);
        if (leaf) {
            const rootNode = extractRootNode(leaf.element);
            if (rootNode) {
                return Location.create(rootNode.$document!.uri.toString(), leaf.range);
            }
        }
    }
    return undefined;
}

