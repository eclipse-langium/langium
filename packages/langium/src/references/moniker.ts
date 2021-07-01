import { Moniker, MonikerKind, UniquenessLevel } from 'vscode-languageserver';
import { LangiumServices } from '../services';
import { AstNode } from '../syntax-tree';
import { AstNodeReference, streamAllContents, streamReferences } from '../utils/ast-util';
import { stream, Stream } from '../utils/stream';
import { NameProvider } from './naming';
/**
 * Moniker POC
 */
export interface MonikerProvider {
    createMonikers(astNode: AstNode): Stream<Moniker>;
}

export interface LangiumMoniker extends Moniker {
    type: string;
}

export class DefaultMonikerProvider implements MonikerProvider {
    protected readonly nameProvider: NameProvider;

    constructor(services: LangiumServices) {
        this.nameProvider = services.references.NameProvider;
    }

    createMonikers(astNode: AstNode): Stream<LangiumMoniker> {
        const monikers: LangiumMoniker[] = [];
        const languageScheme = astNode.$document?.languageId??'onknown';
        const refConverter = (refNode: AstNodeReference) => {
            const astNode = refNode.reference.ref;
            // Do not handle unresolved refs or local references
            if (!astNode || astNode.$document?.uri === refNode.container.$document?.uri)
                return null;
            const name = this.nameProvider.getName(astNode);
            // export everything that has a name by default
            if (name)
                return {
                    identifier: name,
                    scheme: languageScheme,
                    unique: UniquenessLevel.document,
                    kind: MonikerKind.import,
                    type: astNode.$type
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