/******************************************************************************
* Copyright 2021 TypeFox GmbH
* This program and the accompanying materials are made available under the
* terms of the MIT License, which is available in the project root.
******************************************************************************/

import { DefaultReferences, FindReferencesOptions } from '../../references/references';
import { LangiumServices } from '../../services';
import { AstNode, CstNode, Reference } from '../../syntax-tree';
import { extractAssignments, findNameNode, getContainerOfType, getDocument, streamAst, streamReferences } from '../../utils/ast-util';
import { findLeafNodeAtOffset, findRelevantNode, toDocumentSegment } from '../../utils/cst-util';
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

    findReferences(target: AstNode, options: FindReferencesOptions): Stream<ReferenceDescription> {
        if (options.onlyLocal) {
            return this.findLocalReferences(target, options.includeDeclaration);
        } else {
            return this.findGlobalReferences(target, options.includeDeclaration);
        }
    }

    findLocalReferences(target: AstNode, includeDeclaration = false): Stream<ReferenceDescription> {
        const doc = getDocument(target);
        const rootNode = doc.parseResult.value;
        if (isTypeAttribute(target)) {
            return this.findLocalReferencesToTypeAttribute(target, rootNode);
        } else {
            return this.findAllLocalReferences(target, includeDeclaration, rootNode);
        }
    }

    findGlobalReferences(target: AstNode, includeDeclaration = false): Stream<ReferenceDescription> {
        if (isTypeAttribute(target)) {
            return this.findReferencesToTypeAttribute(target);
        } else {
            return this.findAllGlobalReferences(target, includeDeclaration);
        }
    }

    findAllLocalReferences(target: AstNode, includeDeclaration: boolean, rootNode: AstNode): Stream<ReferenceDescription> {
        const refs: ReferenceDescription[] = [];
        if (includeDeclaration) {
            const ref = this.getReferenceToSelf(target);
            if (ref) {
                refs.push(ref);
            }
        }
        const localReferences: Reference[] = [];
        streamAst(rootNode).forEach(node => {
            streamReferences(node).forEach(refInfo => {
                if (refInfo.reference.ref === target) {
                    localReferences.push(refInfo.reference);
                }
            });
        });
        localReferences.forEach(ref => {
            refs.push({
                sourceUri: getDocument(ref.$refNode.element).uri,
                sourcePath: this.nodeLocator.getAstNodePath(ref.$refNode.element),
                targetUri: getDocument(target).uri,
                targetPath: this.nodeLocator.getAstNodePath(target),
                segment: toDocumentSegment(ref.$refNode),
                local: equalURI(getDocument(ref.$refNode.element).uri, getDocument(target).uri)
            });
        });
        return stream(refs);
    }

    findAllGlobalReferences(target: AstNode, includeDeclaration: boolean): Stream<ReferenceDescription> {
        const refs: ReferenceDescription[] = [];
        if (includeDeclaration) {
            const ref = this.getReferenceToSelf(target);
            if (ref) {
                refs.push(ref);
            }
        }
        refs.push(...this.index.findAllReferences(target, this.nodeLocator.getAstNodePath(target)));
        return stream(refs);
    }

    findLocalReferencesToTypeAttribute(target: TypeAttribute, rootNode: AstNode): Stream<ReferenceDescription> {
        const refs: ReferenceDescription[] = [];
        const interfaceNode = getContainerOfType(target, isInterface);
        if (interfaceNode) {
            const interfaces = collectChildrenTypes(interfaceNode, this, this.documents, this.nodeLocator);
            const targetRules: Array<ParserRule | Action> = [];
            interfaces.forEach(interf => {
                const rules = this.findLocalRulesWithReturnType(interf, rootNode);
                targetRules.push(...rules);
            });
            if (equalURI(getDocument(target).uri, getDocument(rootNode).uri)) {
                const ref = this.getReferenceToSelf(target);
                if (ref) {
                    refs.push(ref);
                }
            }
            targetRules.forEach(rule => {
                const assignment = isParserRule(rule) ?
                    extractAssignments(rule.definition).find(a => a.feature === target.name)
                    : getContainerOfType(rule, isGroup)!.elements.find(el => isAssignment(el) && el.feature === target.name);
                if (assignment?.$cstNode) {
                    const leaf = findLeafNodeAtOffset(assignment.$cstNode!, assignment.$cstNode!.offset);
                    if (leaf) {
                        refs.push({
                            sourceUri: getDocument(assignment).uri,
                            sourcePath: this.nodeLocator.getAstNodePath(assignment),
                            targetUri: getDocument(target).uri,
                            targetPath: this.nodeLocator.getAstNodePath(target),
                            segment: toDocumentSegment(leaf),
                            local: equalURI(getDocument(assignment).uri, getDocument(target).uri)
                        });
                    }
                }
            });
        }
        return stream(refs);
    }

    findReferencesToTypeAttribute(target: TypeAttribute): Stream<ReferenceDescription> {
        const refs: ReferenceDescription[] = [];
        const interfaceNode = getContainerOfType(target, isInterface);
        if (interfaceNode) {
            const ref = this.getReferenceToSelf(target);
            if (ref) {
                refs.push(ref);
            }
            const interfaces = collectChildrenTypes(interfaceNode, this, this.documents, this.nodeLocator);
            const targetRules: Array<ParserRule | Action> = [];
            interfaces.forEach(interf => {
                const rules = this.findRulesWithReturnType(interf);
                targetRules.push(...rules);
            });
            targetRules.forEach(rule => {
                const assignment = isParserRule(rule) ?
                    extractAssignments(rule.definition).find(a => a.feature === target.name)
                    : getContainerOfType(rule, isGroup)!.elements.find(el => isAssignment(el) && el.feature === target.name);
                if (assignment?.$cstNode) {
                    const leaf = findLeafNodeAtOffset(assignment.$cstNode!, assignment.$cstNode!.offset);
                    if (leaf) {
                        refs.push({
                            sourceUri: getDocument(assignment).uri,
                            sourcePath: this.nodeLocator.getAstNodePath(assignment),
                            targetUri: getDocument(target).uri,
                            targetPath: this.nodeLocator.getAstNodePath(target),
                            segment: toDocumentSegment(leaf),
                            local: equalURI(getDocument(assignment).uri, getDocument(target).uri)
                        });
                    }
                }
            });
        }
        return stream(refs);
    }

    findAssignmentDeclaration(assignment: Assignment): CstNode | undefined {
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

    findRulesWithReturnType(interf: Interface | Type): Array<ParserRule | Action> {
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

    findLocalRulesWithReturnType(interf: Type | Interface, rootNode: AstNode): Array<ParserRule | Action> {
        const rules: Array<ParserRule | Action> = [];
        const parserRulesOrActions = streamAst(rootNode).filter(node => (isParserRule(node) && node.returnType?.ref === interf) || (isAction(node) && node.type?.ref === interf));
        parserRulesOrActions.forEach(rule => {
            if (isParserRule(rule) || isAction(rule)) {
                rules.push(rule);
            }
        });
        return rules;
    }

    getReferenceToSelf(target: AstNode): ReferenceDescription | undefined {
        const nameNode = findNameNode(target, this.nameProvider);
        if (nameNode) {
            const doc = getDocument(target);
            const path = this.nodeLocator.getAstNodePath(target);
            return {
                sourceUri: doc.uri,
                sourcePath: path,
                targetUri: doc.uri,
                targetPath: path,
                segment: toDocumentSegment(nameNode),
                local: true
            };
        }
        return undefined;
    }
}
