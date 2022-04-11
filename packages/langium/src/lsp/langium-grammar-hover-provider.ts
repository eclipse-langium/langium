/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
import { Hover, HoverParams } from 'vscode-languageserver';
import {CrossReference, findLeafNodeAtOffset, findNameAssignment, Grammar, isCrossReference, isParserRule, isType, LangiumDocuments, LangiumServices, RuleCall } from '..';
import { AstNode } from '../syntax-tree';
import { findRelevantNode } from '../utils/cst-util';
import { MaybePromise } from '../utils/promise-util';
import { LangiumDocument } from '../workspace/documents';
import { MultilineCommentHoverProvider } from './hover-provider';

export class LangiumGrammarHoverProvider extends MultilineCommentHoverProvider {

    readonly grammar: Grammar;
    readonly documents: LangiumDocuments;
    constructor(services: LangiumServices) {
        super(services);
        this.grammar = services.Grammar;
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    getHoverContent(document: LangiumDocument<AstNode>, params: HoverParams): MaybePromise<Hover | undefined> {
        const rootNode = document.parseResult?.value?.$cstNode;
        if(rootNode)  {
            const offset = document.textDocument.offsetAt(params.position);
            const cstNode = findLeafNodeAtOffset(rootNode, offset);
            if(cstNode){
                const relevantNode = findRelevantNode(cstNode);
                if(isCrossReference(relevantNode)){
                    return this.getCrossReferenceHoverContent(relevantNode);
                } else {
                    return super.getHoverContent(document, params);
                }
            }
        }
        return undefined;
    }

    getCrossReferenceHoverContent(node: CrossReference): MaybePromise<Hover | undefined> {

        const ref = node.type.ref;

        if(ref){
            if(isType(ref)){
                return {
                    contents: {
                        kind: 'markdown',
                        value: ref.$cstNode!.text
                    }
                };
            }
            else if(isParserRule(ref)){
                let terminal;
                if(node.$cstNode?.text.includes(':')){
                    terminal = node.$cstNode?.text.split(':')[1].replace(']', '');
                } else {
                    terminal = (findNameAssignment(ref)?.terminal as RuleCall).rule.$refText;
                }

                return {
                    contents: {
                        kind: 'markdown',
                        value: `[${ref.name}:${terminal}]`,
                    },
                };
            }
        }

        return undefined;
    }

}
