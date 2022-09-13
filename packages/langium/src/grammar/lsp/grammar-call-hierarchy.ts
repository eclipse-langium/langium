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
import { Stream } from '../../utils/stream';
import { ReferenceDescription } from '../../workspace/ast-descriptions';
import { isParserRule, isRuleCall } from '../generated/ast';

export class LangiumGrammarCallHierarchyProvider extends AbstractCallHierarchyProvider {
    protected getIncomingCalls(node: AstNode, references: Stream<ReferenceDescription>): CallHierarchyIncomingCall[] | undefined {
        if (!isParserRule(node)) {
            return undefined;
        }
        // This map is used to group incoming calls to avoid duplicates.
        const uniqueRules = new Map<string, { parserRule: CstNode, nameNode: CstNode, targetNodes: CstNode[], docUri: string }>();
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
            if (!parserRule || !parserRule.$cstNode) {
                return;
            }
            const nameNode = this.nameProvider.getNameNode(parserRule);
            if (!nameNode) {
                return;
            }
            const refDocUri = ref.sourceUri.toString();
            const ruleId = refDocUri + '@' + nameNode.text;

            uniqueRules.has(ruleId) ?
                uniqueRules.set(ruleId, { parserRule: parserRule.$cstNode, nameNode, targetNodes: [...uniqueRules.get(ruleId)!.targetNodes, targetNode], docUri: refDocUri })
                : uniqueRules.set(ruleId, { parserRule: parserRule.$cstNode, nameNode, targetNodes: [targetNode], docUri: refDocUri });
        });
        if (uniqueRules.size === 0) {
            return undefined;
        }
        return Array.from(uniqueRules.values()).map(rule => ({
            from: {
                kind: SymbolKind.Method,
                name: rule.nameNode.text,
                range: rule.parserRule.range,
                selectionRange: rule.nameNode.range,
                uri: rule.docUri
            },
            fromRanges: rule.targetNodes.map(node => node.range)
        }));
    }

    protected getOutgoingCalls(node: AstNode): CallHierarchyOutgoingCall[] | undefined {
        if (!isParserRule(node)) {
            return undefined;
        }
        const ruleCalls = streamAllContents(node).filter(isRuleCall).toArray();
        // This map is used to group outgoing calls to avoid duplicates.
        const uniqueRules = new Map<string, { refCstNode: CstNode, to: CstNode, from: Range[], docUri: string }>();
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
                uniqueRules.set(ruleId, { refCstNode: refCstNode, to: refNameNode, from: [...uniqueRules.get(ruleId)!.from, cstNode.range], docUri: refDocUri })
                : uniqueRules.set(ruleId, { refCstNode: refCstNode, to: refNameNode, from: [cstNode.range], docUri: refDocUri });
        });
        if (uniqueRules.size === 0) {
            return undefined;
        }
        return Array.from(uniqueRules.values()).map(rule => ({
            to: {
                kind: SymbolKind.Method,
                name: rule.to.text,
                range: rule.refCstNode.range,
                selectionRange: rule.to.range,
                uri: rule.docUri
            },
            fromRanges: rule.from
        }));
    }
}
