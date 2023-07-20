/******************************************************************************
* Copyright 2021 TypeFox GmbH
* This program and the accompanying materials are made available under the
* terms of the MIT License, which is available in the project root.
******************************************************************************/

import type { LangiumServices } from '../../services';
import type { AstNode, CstNode } from '../../syntax-tree';
import type { Stream } from '../../utils/stream';
import type { ReferenceDescription } from '../../workspace/ast-descriptions';
import type { LangiumDocuments } from '../../workspace/documents';
import type { Action, Assignment, Interface, ParserRule, Type, TypeAttribute } from '../generated/ast';
import type { FindReferencesOptions } from '../../references/references';
import { DefaultReferences } from '../../references/references';
import { getContainerOfType, getDocument } from '../../utils/ast-util';
import { toDocumentSegment } from '../../utils/cst-util';
import { findAssignment, findNodeForProperty } from '../../utils/grammar-util';
import { stream } from '../../utils/stream';
import { equalURI } from '../../utils/uri-util';
import { isAction, isAssignment, isInterface, isParserRule, isType, isTypeAttribute } from '../generated/ast';
import { extractAssignments, getActionAtElement } from '../internal-grammar-util';
import { collectChildrenTypes, collectSuperTypes } from '../type-system/types-util';

export class LangiumGrammarReferences extends DefaultReferences {
    protected readonly documents: LangiumDocuments;

    constructor(services: LangiumServices) {
        super(services);
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    override findDeclaration(sourceCstNode: CstNode): AstNode | undefined {
        const nodeElem = sourceCstNode.astNode;
        const assignment = findAssignment(sourceCstNode);
        if (assignment && assignment.feature === 'feature') {
            // Only search for a special declaration if the cst node is the feature property of the action/assignment
            if (isAssignment(nodeElem)) {
                return this.findAssignmentDeclaration(nodeElem);
            } else if (isAction(nodeElem)) {
                return this.findActionDeclaration(nodeElem);
            }
        }
        return super.findDeclaration(sourceCstNode);
    }

    override findReferences(targetNode: AstNode, options: FindReferencesOptions): Stream<ReferenceDescription> {
        if (isTypeAttribute(targetNode)) {
            return this.findReferencesToTypeAttribute(targetNode, options.includeDeclaration ?? false);
        } else {
            return super.findReferences(targetNode, options);
        }
    }

    protected findReferencesToTypeAttribute(targetNode: TypeAttribute, includeDeclaration: boolean): Stream<ReferenceDescription> {
        const refs: ReferenceDescription[] = [];
        const interfaceNode = getContainerOfType(targetNode, isInterface);
        if (interfaceNode) {
            if (includeDeclaration) {
                const ref = this.getReferenceToSelf(targetNode);
                if (ref) {
                    refs.push(ref);
                }
            }
            const interfaces = collectChildrenTypes(interfaceNode, this, this.documents, this.nodeLocator);
            const targetRules: Array<ParserRule | Action> = [];
            interfaces.forEach(interf => {
                const rules = this.findRulesWithReturnType(interf);
                targetRules.push(...rules);
            });
            targetRules.forEach(rule => {
                const references = this.createReferencesToAttribute(rule, targetNode);
                refs.push(...references);
            });
        }
        return stream(refs);
    }

    protected createReferencesToAttribute(ruleOrAction: ParserRule | Action, attribute: TypeAttribute): ReferenceDescription[] {
        const refs: ReferenceDescription[] = [];
        if (isParserRule(ruleOrAction)) {
            const assignment = extractAssignments(ruleOrAction.definition).find(a => a.feature === attribute.name);
            if (assignment?.$cstNode) {
                const leaf = this.nameProvider.getNameNode(assignment);
                if (leaf) {
                    refs.push({
                        sourceUri: getDocument(assignment).uri,
                        sourcePath: this.nodeLocator.getAstNodePath(assignment),
                        targetUri: getDocument(attribute).uri,
                        targetPath: this.nodeLocator.getAstNodePath(attribute),
                        segment: toDocumentSegment(leaf),
                        local: equalURI(getDocument(assignment).uri, getDocument(attribute).uri)
                    });
                }
            }
        } else {
            // If the action references the attribute directly
            if (ruleOrAction.feature === attribute.name) {
                const leaf = findNodeForProperty(ruleOrAction.$cstNode, 'feature');
                if (leaf) {
                    refs.push({
                        sourceUri: getDocument(ruleOrAction).uri,
                        sourcePath: this.nodeLocator.getAstNodePath(ruleOrAction),
                        targetUri: getDocument(attribute).uri,
                        targetPath: this.nodeLocator.getAstNodePath(attribute),
                        segment: toDocumentSegment(leaf),
                        local: equalURI(getDocument(ruleOrAction).uri, getDocument(attribute).uri)
                    });
                }
            }
            // Find all references within the parser rule that contains this action
            const parserRule = getContainerOfType(ruleOrAction, isParserRule);
            refs.push(...this.createReferencesToAttribute(parserRule!, attribute));
        }
        return refs;
    }

    protected findAssignmentDeclaration(assignment: Assignment): AstNode | undefined {
        const parserRule = getContainerOfType(assignment, isParserRule);
        const action = getActionAtElement(assignment);
        if (action) {
            const actionDeclaration = this.findActionDeclaration(action, assignment.feature);
            if (actionDeclaration) {
                return actionDeclaration;
            }
        }
        if (parserRule?.returnType?.ref) {
            if (isInterface(parserRule.returnType.ref) || isType(parserRule.returnType.ref)) {
                const interfaces = collectSuperTypes(parserRule.returnType.ref);
                for (const interf of interfaces) {
                    const typeAttribute = interf.attributes.find(att => att.name === assignment.feature);
                    if (typeAttribute) {
                        return typeAttribute;
                    }
                }
            }
        }
        return assignment;
    }

    protected findActionDeclaration(action: Action, featureName?: string): TypeAttribute | undefined {
        if (action.type?.ref) {
            const feature = featureName ?? action.feature;
            const interfaces = collectSuperTypes(action.type.ref);
            for (const interf of interfaces) {
                const typeAttribute = interf.attributes.find(att => att.name === feature);
                if (typeAttribute) {
                    return typeAttribute;
                }
            }
        }
        return undefined;
    }

    protected findRulesWithReturnType(interf: Interface | Type): Array<ParserRule | Action> {
        const rules: Array<ParserRule | Action> = [];
        const refs = this.index.findAllReferences(interf, this.nodeLocator.getAstNodePath(interf));
        refs.forEach(ref => {
            const doc = this.documents.getOrCreateDocument(ref.sourceUri);
            const astNode = this.nodeLocator.getAstNode(doc.parseResult.value, ref.sourcePath);
            if (isParserRule(astNode) || isAction(astNode)) {
                rules.push(astNode);
            }
        });
        return rules;
    }
}
