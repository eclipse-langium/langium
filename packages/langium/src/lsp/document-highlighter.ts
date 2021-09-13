/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import * as vscodeLanguageserver from 'vscode-languageserver';
import { LangiumDocument } from '../documents/document';
import { NameProvider } from '../references/naming';
import { References } from '../references/references';
import { LangiumServices } from '../services';
import { AstNode, CstNode } from '../syntax-tree';
import { findLeafNodeAtOffset, findLocalReferences, getDocument } from '../utils/ast-util';
import { toRange } from '../utils/cst-util';

export interface DocumentHighlighter {
    findHighlights(document: LangiumDocument, params: vscodeLanguageserver.DocumentHighlightParams): vscodeLanguageserver.Location[];
}

export class DefaultDocumentHighlighter implements DocumentHighlighter {
    protected readonly references: References;
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.references = services.references.References;
        this.nameProvider = services.references.NameProvider;
    }

    findHighlights(document: LangiumDocument, params: vscodeLanguageserver.DocumentHighlightParams): vscodeLanguageserver.Location[] {
        const rootNode = document.parseResult?.value?.$cstNode;
        if (!rootNode) {
            return [];
        }
        const refs: CstNode[] = [];
        const selectedNode = findLeafNodeAtOffset(rootNode, document.textDocument.offsetAt(params.position));
        if (!selectedNode) {
            return [];
        }
        const targetAstNode = this.references.findDeclaration(selectedNode)?.element;
        if (targetAstNode) {
            if (getDocument(targetAstNode).textDocument.uri === document.textDocument.uri) {
                const nameNode = this.findNameNode(targetAstNode);
                if (nameNode) {
                    refs.push(nameNode);
                }
            }
            findLocalReferences(targetAstNode, rootNode.element).forEach((element) => {
                refs.push(element.$refNode);
            });
        }
        return refs.map(node => vscodeLanguageserver.Location.create(
            document.textDocument.uri,
            toRange(node, document)
        ));
    }
    protected findNameNode(node: AstNode): CstNode | undefined {
        const nameNode = this.nameProvider.getNameNode(node);
        if (nameNode)
            return nameNode;
        return node.$cstNode;
    }
}
