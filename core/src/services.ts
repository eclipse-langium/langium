import { LangiumParser } from './parser/langium-parser';
import { GrammarAccess } from './grammar/grammar-access';
import { AstReflection } from './generator/ast-node';
import { DocumentBuilder } from './documents/document-builder';
import { Connection } from 'vscode-languageserver/node';
import { Linker } from './references/linker';
import { NameProvider } from './references/naming';
import { ScopeProvider, ScopeComputation } from './references/scope';
import { ValidationRegistry } from './service/validation/validation-registry';
import { DocumentValidator } from './service/validation/document-validator';

export type LangiumGeneratedServices = {
    Parser: LangiumParser,
    GrammarAccess: GrammarAccess,
    AstReflection: AstReflection
}

export type LangiumServices = LangiumGeneratedServices & {
    documents: {
        DocumentBuilder: DocumentBuilder
    },
    languageServer: {
        Connection?: Connection
    },
    references: {
        Linker: Linker,
        NameProvider: NameProvider,
        ScopeProvider: ScopeProvider,
        ScopeComputation: ScopeComputation
    },
    validation: {
        DocumentValidator: DocumentValidator,
        ValidationRegistry: ValidationRegistry
    }
}

type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]>;
}

export type PartialLangiumServices = DeepPartial<LangiumServices>
