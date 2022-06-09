/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { ReferenceParams, Range } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { DefaultReferenceFinder } from '../../lsp';
import { LangiumServices } from '../../services';
import { AstNode, LeafCstNode } from '../../syntax-tree';
import { extractAssignments, extractRootNode, getContainerOfType } from '../../utils/ast-util';
import { findLeafNodeAtOffset } from '../../utils/cst-util';
import { ReferenceDescription } from '../../workspace/ast-descriptions';
import { AstNodeLocator } from '../../workspace/ast-node-locator';
import { LangiumDocument, LangiumDocuments } from '../../workspace/documents';
import { AbstractType, Action, Assignment, Interface, isAction, isAssignment, isGroup, isInterface, isParserRule, isType, isTypeAttribute, ParserRule, Type, TypeAttribute } from '../generated/ast';

export class LangiumGrammarReferenceFinder extends DefaultReferenceFinder {
    readonly astNodeLocator: AstNodeLocator;
    readonly langiumDocuments: LangiumDocuments;

    constructor(services: LangiumServices) {
        super(services);
        this.astNodeLocator = services.workspace.AstNodeLocator;
        this.langiumDocuments = services.shared.workspace.LangiumDocuments;
    }

    protected getReferences(selectedNode: LeafCstNode, params: ReferenceParams, document: LangiumDocument<AstNode>): Array<{ docUri: URI; range: Range; }> {
        const refs: Array<{ docUri: URI; range: Range; }> = [];
        const targetAstNode = selectedNode.element;

        if (isTypeAttribute(targetAstNode)) {
            refs.push(...this.getReferencesFromTypeAttribute(targetAstNode, selectedNode));
            if (params.context.includeDeclaration) {
                const leafNode = findLeafNodeAtOffset(selectedNode, selectedNode.offset);
                refs.push({ docUri: document.uri, range: leafNode!.range});
            }
        } else if (isAssignment(targetAstNode)) {
            refs.push(...this.getReferencesFromAssignment(targetAstNode, selectedNode, params, document));
        } else {
            refs.push(...super.getReferences(selectedNode, params, document));
        }

        return refs;
    }

    getReferencesFromAssignment(targetAstNode: Assignment, selectedNode: LeafCstNode, params: ReferenceParams, document: LangiumDocument<AstNode>): Array<{ docUri: URI; range: Range; }>{
        const refs: Array<{ docUri: URI; range: Range; }> = [];
        const parserRule = getContainerOfType(targetAstNode, isParserRule);
        const groupNode = getContainerOfType(targetAstNode, isGroup);

        if (parserRule?.returnType?.ref) {
            const interfaces = this.getInterfacesFromAssignment(parserRule.returnType.ref);
            interfaces.forEach(interfaceNode => {
                const leafNode = this.findLeafNodeInInterface(interfaceNode,selectedNode.text);
                if (leafNode) {
                    refs.push(...this.getReferences(leafNode, params, document));
                }
            });
        }

        if (groupNode) {
            const action = groupNode.elements.find(el => isAction(el));
            if (isAction(action)) {
                const ref = action.type?.ref;
                if (ref) {
                    const interfaces = this.getInterfacesFromAssignment(ref);
                    interfaces.forEach(interfaceNode => {
                        const leafNode = this.findLeafNodeInInterface(interfaceNode,selectedNode.text);
                        if (leafNode) {
                            refs.push(...this.getReferences(leafNode, params, document));
                        }
                    });
                }

            }
        }

        return refs;
    }

    findLeafNodeInInterface(interfaceNode: Interface, text: string): LeafCstNode | undefined {
        const attribute = interfaceNode.attributes.find(a => a.name === text);
        if (attribute) {
            const cstNode = attribute.$cstNode;
            if (cstNode) {
                const leafNode = findLeafNodeAtOffset(cstNode, cstNode.offset);
                if (leafNode) {
                    return leafNode;
                }
            }
        }
        return undefined;
    }

    getInterfacesFromAssignment(ref: AbstractType): Set<Interface> {
        let interfaces: Set<Interface> = new Set<Interface>();
        if (isInterface(ref)) {
            interfaces = this.collectSuperTypes(ref);
            interfaces.add(ref);
        } else if (isType(ref)) {
            interfaces = this.collectSuperTypes(ref);
        }
        return interfaces;
    }

    getReferencesFromTypeAttribute(typeAttributeNode: TypeAttribute, selectedNode: LeafCstNode): Array<{ docUri: URI; range: Range; }> {
        const refs: Array<{ docUri: URI; range: Range; }> = [];
        const interfaceNode = getContainerOfType(typeAttributeNode, isInterface);
        if (interfaceNode) {
            const collectedTypes = this.collectChildrenTypes(interfaceNode);
            collectedTypes.add(interfaceNode);

            let referencesToTypes: Set<ReferenceDescription> = new Set<ReferenceDescription>();
            collectedTypes.forEach(collectedType => {
                const refs = this.references.findReferences(collectedType).toSet();
                referencesToTypes = new Set<ReferenceDescription>([...referencesToTypes, ...refs]);
            });

            const parserRules: Set<ParserRule | Action> = this.findParserRulesFromReferences(referencesToTypes);

            parserRules.forEach(rule => {
                const assignment = isParserRule(rule) ? extractAssignments(rule.alternatives).find(assignment => assignment.feature === selectedNode.text) : extractAssignments(getContainerOfType(rule, isGroup)!).find(assignment => assignment.feature === selectedNode.text);

                if (assignment) {
                    const cstNode = assignment.$cstNode;
                    if (cstNode) {
                        const leaf = findLeafNodeAtOffset(cstNode, cstNode.offset);
                        if (leaf) {
                            const rootNode = extractRootNode(leaf.element);
                            if (rootNode) {
                                refs.push({
                                    docUri: rootNode.$document!.uri,
                                    range: leaf.range
                                });
                            }
                        }
                    }
                }
            });
        }
        return refs;
    }

    findParserRulesFromReferences(referencesToTypes: Set<ReferenceDescription>): Set<ParserRule | Action> {
        const parserRules: Set<ParserRule | Action> = new Set<ParserRule | Action>();
        referencesToTypes.forEach(ref => {
            const doc = this.langiumDocuments.getOrCreateDocument(ref.sourceUri);
            const astNode = this.astNodeLocator.getAstNode(doc, ref.sourcePath);
            if (isParserRule(astNode) || isAction(astNode)) {
                parserRules.add(astNode);
            }
        });
        return parserRules;
    }

    collectChildrenTypes(interfaceRule: Interface): Set<Interface | Type> {
        let childrenTypes = new Set<Interface | Type>();
        const refs = this.references.findReferences(interfaceRule).toArray();

        refs.forEach(ref => {
            const doc = this.langiumDocuments.getOrCreateDocument(ref.sourceUri);
            const astNode = this.astNodeLocator.getAstNode(doc, ref.sourcePath);
            if (isInterface(astNode)) {
                childrenTypes.add(astNode);
                childrenTypes = new Set([...childrenTypes, ...this.collectChildrenTypes(astNode)]);
            } else if (isType(astNode?.$container)) {
                childrenTypes.add(astNode!.$container);
            }
        });

        return childrenTypes;
    }

    collectSuperTypes(ruleNode: Interface | Type): Set<Interface> {
        let superTypes: Set<Interface> = new Set<Interface>();
        if (isInterface(ruleNode)) {
            superTypes.add(ruleNode);
            ruleNode.superTypes.forEach(superType => {
                if (isInterface(superType.ref)) {
                    superTypes.add(superType.ref);
                    superTypes = new Set([...superTypes, ...this.collectSuperTypes(superType.ref)]);
                }
            });
        } else if (isType(ruleNode)) {
            ruleNode.typeAlternatives.forEach(typeAlternative => {
                if (typeAlternative.refType?.ref) {
                    if (isInterface(typeAlternative.refType.ref) || isType(typeAlternative.refType.ref)) {
                        superTypes = new Set<Interface>([...superTypes, ...this.collectSuperTypes(typeAlternative.refType!.ref!)]);
                    }
                }
            });
        }

        return superTypes;
    }
}

