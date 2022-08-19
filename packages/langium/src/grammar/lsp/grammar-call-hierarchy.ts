/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { CallHierarchyIncomingCall, CallHierarchyOutgoingCall, Range, SymbolKind } from 'vscode-languageserver';
import { DefaultCallHierarchyProvider } from '../../lsp/call-hierarchy-provider';
import { AstNode, CstNode } from '../../syntax-tree';
import { getContainerOfType, getDocument, streamAllContents } from '../../utils/ast-util';
import { findLeafNodeAtOffset } from '../../utils/cst-util';
import { ReferenceDescription } from '../../workspace/ast-descriptions';
import { isParserRule, isRuleCall, RuleCall } from '../generated/ast';

export class LangiumGrammarCallHierarchyProvider extends DefaultCallHierarchyProvider {
    protected getIncomingCalls(references: ReferenceDescription[]): CallHierarchyIncomingCall[] | null {
        // This map is used to group incoming calls to avoid duplicates.
        const uniqueRules = new Map<string, { nameNode: CstNode, targetNodes: CstNode[], docUri: string }>();
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
            uniqueRules.has(ruleId) ?
                uniqueRules.set(ruleId, { nameNode, targetNodes: [...uniqueRules.get(ruleId)!.targetNodes, targetNode], docUri: refDocUri })
                : uniqueRules.set(ruleId, { nameNode, targetNodes: [targetNode], docUri: refDocUri });
        });
        if (uniqueRules.size === 0) {
            return null;
        }
        const incomingCalls: CallHierarchyIncomingCall[] = [];
        uniqueRules.forEach(nodes => {
            incomingCalls.push({
                from: {
                    kind: SymbolKind.Method,
                    name: nodes.nameNode.text,
                    range: nodes.nameNode.range,
                    selectionRange: nodes.nameNode.range,
                    uri: nodes.docUri
                },
                fromRanges: nodes.targetNodes.map(node => node.range)
            });
        });
        return incomingCalls;
    }

    protected getOutgoingCalls(node: AstNode): CallHierarchyOutgoingCall[] | null {
        if (isParserRule(node)) {
            const ruleCalls = streamAllContents(node).toArray().filter(n => isRuleCall(n)) as RuleCall[];
            // This map is used to group outgoing calls to avoid duplicates.
            const uniqueRules = new Map<string, {to: CstNode, from: Range[], docUri: string}>();
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
                uniqueRules.has(ruleId) ?
                    uniqueRules.set(ruleId, { to: refNameNode, from: [...uniqueRules.get(ruleId)!.from, cstNode.range], docUri: refDocUri })
                    : uniqueRules.set(ruleId, { to: refNameNode, from: [cstNode.range], docUri: refDocUri });
            });
            if (uniqueRules.size === 0) {
                return null;
            }
            const outgoingCalls: CallHierarchyOutgoingCall[] = [];
            uniqueRules.forEach(rule => {
                outgoingCalls.push({
                    to: {
                        kind: SymbolKind.Method,
                        name: rule.to.text,
                        range: rule.to.range,
                        selectionRange: rule.to.range,
                        uri: rule.docUri
                    },
                    fromRanges: rule.from
                });
            });
            return outgoingCalls;
        }
        return null;
    }
}