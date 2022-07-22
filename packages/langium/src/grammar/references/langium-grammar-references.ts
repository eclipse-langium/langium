/******************************************************************************
* Copyright 2021 TypeFox GmbH
* This program and the accompanying materials are made available under the
* terms of the MIT License, which is available in the project root.
******************************************************************************/

import { DefaultReferences } from '../../references/references';
import { LangiumServices } from '../../services';
import { AstNode, CstNode } from '../../syntax-tree';
import { extractAssignments, findNameNode, getContainerOfType, getDocument, streamAst } from '../../utils/ast-util';
import { findRelevantNode, toDocumentSegment } from '../../utils/cst-util';
import { stream, Stream } from '../../utils/stream';
import { equalURI } from '../../utils/uri-utils';
import { ReferenceDescription } from '../../workspace/ast-descriptions';
import { LangiumDocuments } from '../../workspace/documents';
import { Action, Assignment, Interface, isAction, isAssignment, isGroup, isInterface, isParserRule, isType, isTypeAttribute, ParserRule, Type, TypeAttribute } from '../generated/ast';
import { findNodeForFeature } from '../grammar-util';
import { collectChildrenTypes, collectSuperTypes } from '../type-system/types-util';

export class LangiumGrammarReferences extends DefaultReferences {
    protected readonly documents: LangiumDocuments;

    constructor(services: LangiumServices) {
        super(services);
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    findDeclaration(sourceCstNode: CstNode): CstNode | undefined {
        const nodeElem = findRelevantNode(sourceCstNode);
        if (isAssignment(nodeElem)) {
            return this.findAssignmentDeclaration(nodeElem);
        }
        return super.findDeclaration(sourceCstNode);
    }

    protected findLocalReferences(targetNode: AstNode, includeDeclaration = false): Stream<ReferenceDescription> {
        if (isTypeAttribute(targetNode)) {
            const doc = getDocument(targetNode);
            const rootNode = doc.parseResult.value;
            return this.findLocalReferencesToTypeAttribute(targetNode, rootNode, includeDeclaration);
        } else {
            return super.findLocalReferences(targetNode, includeDeclaration);
        }
    }

    protected findGlobalReferences(targetNode: AstNode, includeDeclaration = false): Stream<ReferenceDescription> {
        if (isTypeAttribute(targetNode)) {
            return this.findReferencesToTypeAttribute(targetNode, includeDeclaration);
        } else {
            return super.findGlobalReferences(targetNode, includeDeclaration);
        }
    }

    protected findLocalReferencesToTypeAttribute(targetNode: TypeAttribute, rootNode: AstNode, includeDeclaration: boolean): Stream<ReferenceDescription> {
        const refs: ReferenceDescription[] = [];
        const interfaceNode = getContainerOfType(targetNode, isInterface);
        if (interfaceNode) {
            const interfaces = collectChildrenTypes(interfaceNode, this, this.documents, this.nodeLocator);
            const targetRules: Array<ParserRule | Action> = [];
            interfaces.forEach(interf => {
                const rules = this.findLocalRulesWithReturnType(interf, rootNode);
                targetRules.push(...rules);
            });
            if (equalURI(getDocument(targetNode).uri, getDocument(rootNode).uri) && includeDeclaration) {
                const ref = this.getReferenceToSelf(targetNode);
                if (ref) {
                    refs.push(ref);
                }
            }
            targetRules.forEach(rule => {
                const assignment = isParserRule(rule) ?
                    extractAssignments(rule.definition).find(a => a.feature === targetNode.name)
                    : getContainerOfType(rule, isGroup)!.elements.find(el => isAssignment(el) && el.feature === targetNode.name);
                if (assignment?.$cstNode) {
                    const leaf = findNodeForFeature(assignment.$cstNode, 'feature');
                    if (leaf) {
                        refs.push({
                            sourceUri: getDocument(assignment).uri,
                            sourcePath: this.nodeLocator.getAstNodePath(assignment),
                            targetUri: getDocument(targetNode).uri,
                            targetPath: this.nodeLocator.getAstNodePath(targetNode),
                            segment: toDocumentSegment(leaf),
                            local: equalURI(getDocument(assignment).uri, getDocument(targetNode).uri)
                        });
                    }
                }
            });
        }
        return stream(refs);
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
                const assignment = isParserRule(rule) ?
                    extractAssignments(rule.definition).find(a => a.feature === targetNode.name)
                    : getContainerOfType(rule, isGroup)!.elements.find(el => isAssignment(el) && el.feature === targetNode.name);
                if (assignment?.$cstNode) {
                    const leaf = findNodeForFeature(assignment.$cstNode, 'feature');
                    if (leaf) {
                        refs.push({
                            sourceUri: getDocument(assignment).uri,
                            sourcePath: this.nodeLocator.getAstNodePath(assignment),
                            targetUri: getDocument(targetNode).uri,
                            targetPath: this.nodeLocator.getAstNodePath(targetNode),
                            segment: toDocumentSegment(leaf),
                            local: equalURI(getDocument(assignment).uri, getDocument(targetNode).uri)
                        });
                    }
                }
            });
        }
        return stream(refs);
    }

    protected findAssignmentDeclaration(assignment: Assignment): CstNode | undefined {
        const parserRule = getContainerOfType(assignment, isParserRule);
        const groupNode = getContainerOfType(assignment, isGroup);
        if (parserRule?.returnType?.ref) {
            if (isInterface(parserRule.returnType.ref) || isType(parserRule.returnType.ref)) {
                const interfaces = collectSuperTypes(parserRule.returnType.ref);
                for (const interf of interfaces) {
                    const typeAttribute = interf.attributes.find(att => att.name === assignment.feature);
                    if (typeAttribute) {
                        return findNameNode(typeAttribute, this.nameProvider);
                    }
                }
            }
        }
        if (groupNode) {
            const action = groupNode.elements.find(el => isAction(el)) as Action | undefined;
            if (action) {
                if (action.type?.ref) {
                    const interfaces = collectSuperTypes(action.type.ref);
                    for (const interf of interfaces) {
                        const typeAttribute = interf.attributes.find(att => att.name === assignment.feature);
                        if (typeAttribute) {
                            return findNameNode(typeAttribute, this.nameProvider);
                        }
                    }
                }
            }
        }
        return findNodeForFeature(assignment.$cstNode,'feature');
    }

    protected findRulesWithReturnType(interf: Interface | Type): Array<ParserRule | Action> {
        const rules: Array<ParserRule | Action> = [];
        const refs = this.index.findAllReferences(interf, this.nodeLocator.getAstNodePath(interf));
        refs.forEach(ref => {
            const doc = this.documents.getOrCreateDocument(ref.sourceUri);
            const astNode = this.nodeLocator.getAstNode(doc, ref.sourcePath);
            if (isParserRule(astNode) || isAction(astNode)) {
                rules.push(astNode);
            }
        });
        return rules;
    }

    protected findLocalRulesWithReturnType(interf: Type | Interface, rootNode: AstNode): Array<ParserRule | Action> {
        const rules: Array<ParserRule | Action> = [];
        const parserRulesOrActions = streamAst(rootNode).filter(node => (isParserRule(node) && node.returnType?.ref === interf) || (isAction(node) && node.type?.ref === interf));
        parserRulesOrActions.forEach(rule => {
            if (isParserRule(rule) || isAction(rule)) {
                rules.push(rule);
            }
        });
        return rules;
    }
}
