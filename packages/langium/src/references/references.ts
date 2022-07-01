/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { AbstractType, Action, Assignment, Interface, isAction, isAssignment, isGroup, isInterface, isParserRule, isType, isTypeAttribute, ParserRule, Type, TypeAttribute } from '../grammar/generated/ast';
import { findAssignment } from '../grammar/grammar-util';
import { collectChildrenTypes } from '../grammar/type-system/types-util';
import { LangiumServices } from '../services';
import { AstNode, CstNode, Reference } from '../syntax-tree';
import { extractAssignments, getContainerOfType, getDocument, isReference, streamAst, streamReferences } from '../utils/ast-util';
import { findLeafNodeAtOffset, findRelevantNode, toDocumentSegment } from '../utils/cst-util';
import { stream, Stream } from '../utils/stream';
import { equalURI } from '../utils/uri-utils';
import { ReferenceDescription } from '../workspace/ast-descriptions';
import { AstNodeLocator } from '../workspace/ast-node-locator';
import { LangiumDocuments } from '../workspace/documents';
import { IndexManager } from '../workspace/index-manager';
import { NameProvider } from './naming';

/**
 * Language-specific service for finding references and declaration of a given `CstNode`.
 */
export interface References {

    /**
     * If the CstNode is a reference node the target CstNode will be returned.
     * If the CstNode is a significant node of the CstNode this CstNode will be returned.
     *
     * @param sourceCstNode CstNode that points to a AstNode
     */
    findDeclaration(sourceCstNode: CstNode): CstNode | undefined;
    /**
     * Finds all references to the target node as references (local references) or reference descriptions.
     *
     * @param targetNode Specified target node whose references should be returned
     */
    findReferences(target: AstNode, onlyLocal: boolean, includeDeclaration: boolean): Stream<ReferenceDescription>;
}

export class DefaultReferences implements References {
    protected readonly nameProvider: NameProvider;
    protected readonly index: IndexManager;
    protected readonly nodeLocator: AstNodeLocator;
    protected readonly documents: LangiumDocuments;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.index = services.shared.workspace.IndexManager;
        this.nodeLocator = services.workspace.AstNodeLocator;
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    findDeclaration(sourceCstNode: CstNode): CstNode | undefined {
        if (sourceCstNode) {
            const assignment = findAssignment(sourceCstNode);
            const nodeElem = findRelevantNode(sourceCstNode);
            if (assignment && nodeElem) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const reference = (nodeElem as any)[assignment.feature] as unknown;

                if (isReference(reference)) {
                    return this.processReference(reference);
                }
                else if (Array.isArray(reference)) {
                    for (const ref of reference) {
                        if (isReference(ref)) {
                            const target = this.processReference(ref);
                            if (target && target.text === sourceCstNode.text) return target;
                        }
                    }
                }
                else {
                    const nameNode = this.nameProvider.getNameNode(nodeElem);
                    if (nameNode === sourceCstNode
                        || nameNode && nameNode.offset <= sourceCstNode.offset
                        && nameNode.offset + nameNode.length > sourceCstNode.offset) {
                        return nameNode;
                    } else if (isAssignment(nodeElem)) {
                        return this.findAssignmentDeclaration(nodeElem);
                    } else {
                        return sourceCstNode;
                    }
                }
            }
        }
        return undefined;
    }

    findReferences(target: AstNode, onlyLocal: boolean, includeDeclaration: boolean): Stream<ReferenceDescription> {
        if (onlyLocal) {
            return this.findLocalReferences(target, includeDeclaration);
        } else {
            return this.findGlobalReferences(target, includeDeclaration);
        }
    }

    findLocalReferences(target: AstNode, includeDeclaration: boolean): Stream<ReferenceDescription> {
        const doc = getDocument(target);
        const rootNode = doc.parseResult.value;
        if (isTypeAttribute(target)) {
            return this.findLocalReferencesToTypeAttribute(target, rootNode);
        } else {
            return this.findAllLocalReferences(target, includeDeclaration, rootNode);
        }
    }

    findGlobalReferences(target: AstNode, includeDeclaration: boolean): Stream<ReferenceDescription> {
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
                const interfaces = this.collectSuperTypes(parserRule.returnType.ref);
                for (const interf of interfaces) {
                    const typeAttribute = interf.attributes.find(att => att.name === assignment.feature);
                    if (typeAttribute) {
                        return findLeafNodeAtOffset(typeAttribute.$cstNode!, typeAttribute.$cstNode!.offset);
                    }
                }
            }
        }
        if (groupNode) {
            const action = groupNode.elements.find(el => isAction(el)) as Action | undefined;
            if (action) {
                if (action.type?.ref) {
                    const interfaces = this.collectSuperTypes(action.type.ref);
                    for (const interf of interfaces) {
                        const typeAttribute = interf.attributes.find(att => att.name === assignment.feature);
                        if (typeAttribute) {
                            return findLeafNodeAtOffset(typeAttribute.$cstNode!, typeAttribute.$cstNode!.offset);
                        }
                    }
                }
            }
        }
        return undefined;
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

    collectSuperTypes(ruleNode: AbstractType): Set<Interface> {
        const superTypes = new Set<Interface>();
        if (isInterface(ruleNode)) {
            superTypes.add(ruleNode);
            ruleNode.superTypes.forEach(superType => {
                if (isInterface(superType.ref)) {
                    superTypes.add(superType.ref);
                    const collectedSuperTypes = this.collectSuperTypes(superType.ref);
                    for (const superType of collectedSuperTypes) {
                        superTypes.add(superType);
                    }
                }
            });
        } else if (isType(ruleNode)) {
            ruleNode.typeAlternatives.forEach(typeAlternative => {
                if (typeAlternative.refType?.ref) {
                    if (isInterface(typeAlternative.refType.ref) || isType(typeAlternative.refType.ref)) {
                        const collectedSuperTypes = this.collectSuperTypes(typeAlternative.refType.ref);
                        for (const superType of collectedSuperTypes) {
                            superTypes.add(superType);
                        }
                    }
                }
            });
        }
        return superTypes;
    }

    protected processReference(reference: Reference): CstNode | undefined {
        const ref = reference.ref;
        if (ref && ref.$cstNode) {
            const targetNode = this.nameProvider.getNameNode(ref);
            if (!targetNode) {
                return ref.$cstNode;
            }
            else {
                return targetNode;
            }
        }
        return undefined;
    }

    getReferenceToSelf(target: AstNode): ReferenceDescription | undefined {
        const nameNode = this.findNameNode(target);
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

    protected findNameNode(node: AstNode): CstNode | undefined {
        const nameNode = this.nameProvider.getNameNode(node);
        if (nameNode)
            return nameNode;
        const leaf = findLeafNodeAtOffset(node.$cstNode!, node.$cstNode!.offset);
        if (leaf)
            return leaf;
        return node.$cstNode;
    }
}
