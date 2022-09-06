/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { DefinitionParams, LocationLink, Range } from 'vscode-languageserver';
import { DefaultGoToDefinitionProvider } from '../../lsp';
import { LangiumServices } from '../../services';
import { AstNode, LeafCstNode, Properties } from '../../syntax-tree';
import { streamContents } from '../../utils/ast-util';
import { MaybePromise } from '../../utils/promise-util';
import { LangiumDocuments } from '../../workspace/documents';
import { Grammar, GrammarImport, isGrammarImport } from '../generated/ast';
import { findAssignment, resolveImport } from '../grammar-util';

export class LangiumGrammarGoToDefinitionProvider extends DefaultGoToDefinitionProvider {

    protected documents: LangiumDocuments;

    constructor(services: LangiumServices) {
        super(services);
        this.documents = services.shared.workspace.LangiumDocuments;
    }

    protected collectLocationLinks(sourceCstNode: LeafCstNode, _params: DefinitionParams): MaybePromise<LocationLink[] | undefined> {
        const pathFeature: Properties<GrammarImport> = 'path';
        if (isGrammarImport(sourceCstNode.element) && findAssignment(sourceCstNode)?.feature === pathFeature) {
            const importedGrammar = resolveImport(this.documents, sourceCstNode.element);
            if (importedGrammar?.$document) {
                const targetObject = this.findTargetObject(importedGrammar) ?? importedGrammar;
                const selectionRange = this.nameProvider.getNameNode(targetObject)?.range ?? Range.create(0, 0, 0, 0);
                const previewRange = targetObject.$cstNode?.range ?? Range.create(0, 0, 0, 0);
                return [
                    LocationLink.create(
                        importedGrammar.$document.uri.toString(),
                        previewRange,
                        selectionRange,
                        sourceCstNode.range
                    )
                ];
            }
            return undefined;
        }
        return super.collectLocationLinks(sourceCstNode, _params);
    }

    protected findTargetObject(importedGrammar: Grammar): AstNode | undefined {
        // Jump to grammar name or the first element
        if (importedGrammar.isDeclared) {
            return importedGrammar;
        }
        return streamContents(importedGrammar).head();
    }
}
