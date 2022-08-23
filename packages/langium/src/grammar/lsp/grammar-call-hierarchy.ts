/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CallHierarchyIncomingCall, CallHierarchyOutgoingCall, Range, SymbolKind } from 'vscode-languageserver';
import { AbstractCallHierarchyProvider } from '../../lsp/call-hierarchy-provider';
import { AstNode, CstNode } from '../../syntax-tree';
import { getContainerOfType, getDocument, streamAllContents } from '../../utils/ast-util';
import { findLeafNodeAtOffset } from '../../utils/cst-util';
import { ReferenceDescription } from '../../workspace/ast-descriptions';
import { isParserRule, isRuleCall } from '../generated/ast';

export class LangiumGrammarCallHierarchyProvider extends AbstractCallHierarchyProvider {
    protected getIncomingCalls(node: AstNode, references: ReferenceDescription[]): CallHierarchyIncomingCall[] | undefined {
        if (!isParserRule(node)) {
            return undefined;
        }
        const uniqueRules: IncomingCallHelper[] = [];
        references.forEach(ref => {
            const doc = this.documents.getOrCreateDocument(ref.sourceUri);
            const rootNode = doc.parseResult.value;
            if (!rootNode.$cstNode) {
                return;
            }
            const targetNode = findLeafNodeAtOffset(rootNode.$cstNode, ref.segment.offset);
            if (!targetNode) {
                return;
            }
            const parserRule = getContainerOfType(targetNode.element, isParserRule);
            if (!parserRule) {
                return;
            }
            const nameNode = this.nameProvider.getNameNode(parserRule);
            if (!nameNode) {
                return;
            }
            const refDocUri = ref.sourceUri.toString();
            const ruleId = refDocUri + '@' + nameNode.text;

            const indexInArray = uniqueRules.findIndex(r => r.ruleId === ruleId);
            indexInArray === -1 ?
                uniqueRules.push({ ruleId, parserRule: parserRule.$cstNode!, nameNode, targetNodes: [targetNode], docUri: refDocUri})
                : uniqueRules[indexInArray].targetNodes = [...uniqueRules[indexInArray].targetNodes, targetNode];
        });
        if (uniqueRules.length === 0) {
            return undefined;
        }
        return uniqueRules.map(r => {
            return {
                from: {
                    kind: SymbolKind.Method,
                    name: r.nameNode.text,
                    range: r.parserRule.range,
                    selectionRange: r.nameNode.range,
                    uri: r.docUri
                },
                fromRanges: r.targetNodes.map(n => n.range)
            };
        });
    }

    protected getOutgoingCalls(node: AstNode): CallHierarchyOutgoingCall[] | undefined {
        if (isParserRule(node)) {
            const ruleCalls = streamAllContents(node).filter(isRuleCall).toArray();
            const uniqueRules: OutgoingCallHelper[] = [];
            ruleCalls.forEach(ruleCall => {
                const cstNode = ruleCall.$cstNode;
                if (!cstNode) {
                    return;
                }
                const refCstNode = ruleCall.rule.ref?.$cstNode;
                if (!refCstNode) {
                    return;
                }
                const refNameNode = this.nameProvider.getNameNode(refCstNode.element);
                if (!refNameNode) {
                    return;
                }
                const refDocUri = getDocument(refCstNode.element).uri.toString();
                const ruleId = refDocUri + '@' + refNameNode.text;

                const indexInArray = uniqueRules.findIndex(r => r.ruleId === ruleId);
                indexInArray === -1 ?
                    uniqueRules.push({ ruleId, refCstNode: refCstNode, to: refNameNode, from: [cstNode.range], docUri: refDocUri })
                    : uniqueRules[indexInArray].from = [...uniqueRules[indexInArray].from, cstNode.range];
            });
            if (uniqueRules.length === 0) {
                return undefined;
            }
            return uniqueRules.map(rule =>{
                return {
                    to: {
                        kind: SymbolKind.Method,
                        name: rule.to.text,
                        range: rule.refCstNode.range,
                        selectionRange: rule.to.range,
                        uri: rule.docUri
                    },
                    fromRanges: rule.from
                };
            });
        }
        return undefined;
    }
}

interface IncomingCallHelper {
    ruleId: string
    parserRule: CstNode
    nameNode: CstNode
    targetNodes: CstNode[]
    docUri: string
}

interface OutgoingCallHelper {
    ruleId: string
    refCstNode: CstNode
    to: CstNode
    from: Range[]
    docUri: string
}
