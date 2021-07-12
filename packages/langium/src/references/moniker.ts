/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { Moniker, MonikerKind, UniquenessLevel } from 'vscode-languageserver';
import { AstNodePathComputer } from '../index/ast-node-locator';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { AstNodeReference, getDocument, streamAllContents, streamReferences } from '../utils/ast-util';
import { stream, Stream } from '../utils/stream';
import { NameProvider } from './naming';
/**
 * Moniker POC
 */
export interface MonikerProvider {
    createMonikers(astNode: AstNode): Stream<LangiumMoniker>;
}

export interface LangiumMoniker extends Moniker {
    type: string;
}

export class DefaultMonikerProvider implements MonikerProvider {
    protected readonly nameProvider: NameProvider;
    protected readonly astNodePath: AstNodePathComputer;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
        this.astNodePath = services.index.AstNodePathComputer;
    }

    createMonikers(astNode: AstNode): Stream<LangiumMoniker> {
        const monikers: LangiumMoniker[] = [];
        const languageScheme = astNode.$document?.languageId??'unknown';
        const refConverter = (refNode: AstNodeReference) => {
            const refAstNode = refNode.reference.ref;
            if(!refAstNode)
                return null;
            const refTargetDoc = getDocument(refAstNode);
            // Do not handle unresolved refs or local references
            if (refTargetDoc?.uri === getDocument(refNode.container)?.uri)
                return null;
            const path = refTargetDoc?.uri + '#' + this.astNodePath.astNodePath(refAstNode);
            // export everything that has a name by default
            if (path)
                return {
                    identifier: path,
                    scheme: languageScheme,
                    unique: UniquenessLevel.document,
                    kind: MonikerKind.import,
                    type: refAstNode.$type
                };
            return null;
        };
        streamAllContents(astNode).forEach(astNodeContent => {
            const astNode = astNodeContent.node;
            const name = this.nameProvider.getName(astNode);
            const scope = (astNode?.$container)?UniquenessLevel.project:UniquenessLevel.document;
            // export everything that has a name by default
            if (name)
                monikers.push({
                    identifier: name,
                    scheme: languageScheme,
                    unique: scope,
                    kind: MonikerKind.export,
                    type: astNodeContent.node.$type
                });
            streamReferences(astNode).forEach(ref => {
                const refMoniker = refConverter(ref);
                if (refMoniker)
                    monikers.push(refMoniker);
            });
        });
        return stream(monikers);
    }
}
/*
function isLangiumMoniker(obj: unknown): obj is LangiumMoniker & Moniker {
    return typeof obj === 'object' && obj !== null && typeof (obj as LangiumMoniker).type === 'string';
}
*/