/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { Hover, HoverParams } from 'vscode-languageserver';
import { AstNode } from '../../syntax-tree';
import { MaybePromise } from '../../utils/promise-util';
import { MultilineCommentHoverProvider } from '../../lsp/hover-provider';
import { CrossReference, findLeafNodeAtOffset, findNameAssignment, findRelevantNode, Grammar, isCrossReference, isKeyword, isParserRule, isRuleCall, isType, LangiumDocument, LangiumDocuments, LangiumServices } from '../..';

export class LangiumGrammarHoverProvider extends MultilineCommentHoverProvider {

    readonly grammar: Grammar;
    readonly documents: LangiumDocuments;
    constructor(services: LangiumServices) {
        super(services);
        this.grammar = services.Grammar;
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    protected getAstNodeHoverContent(node: AstNode): MaybePromise<Hover | undefined> {
        if(isCrossReference(node)) {
            return this.getCrossReferenceHoverContent(node);
        }
        return super.getAstNodeHoverContent(node);
    }

    getHoverContent(document: LangiumDocument<AstNode>, params: HoverParams): MaybePromise<Hover | undefined> {
        const rootNode = document.parseResult?.value?.$cstNode;
        if (rootNode)  {
            const offset = document.textDocument.offsetAt(params.position);
            const cstNode = findLeafNodeAtOffset(rootNode, offset);
            if (cstNode && cstNode.offset + cstNode.length > offset) {
                const relevantNode = findRelevantNode(cstNode);
                const targetNode = this.references.findDeclaration(cstNode);
                if (isCrossReference(relevantNode)) {
                    return this.getAstNodeHoverContent(relevantNode);
                } else if (targetNode) {
                    return this.getAstNodeHoverContent(targetNode?.element);
                }
            }
        }
        return undefined;
    }

    getCrossReferenceHoverContent(node: CrossReference): MaybePromise<Hover | undefined> {
        const ref = node.type.ref;
        if (ref) {
            if (isType(ref)) {
                return {
                    contents: {
                        kind: 'markdown',
                        value: '```\n' + ref.$cstNode!.text + '\n```'
                    }
                };
            } else if (isParserRule(ref)) {
                const typeName = ref.name;
                const terminal = node.terminal;
                let terminalName = '';
                if (terminal === undefined) {
                    const terminalRule = findNameAssignment(ref);
                    if (terminalRule && isRuleCall(terminalRule.terminal)){
                        terminalName = terminalRule.terminal.rule.ref!.name;
                    }
                } else if (isKeyword(terminal)) {
                    terminalName = terminal.value;
                } else if (isRuleCall(terminal)) {
                    terminalName = terminal.rule.ref!.name;
                }

                return {
                    contents: {
                        kind: 'markdown',
                        value: '```\n' + `[${typeName}:${terminalName}]` + '\n```'
                    }
                };
            }
        }
        return undefined;
    }

}
