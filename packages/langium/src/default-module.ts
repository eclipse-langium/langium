import { Module } from './dependency-injection';
import { LangiumServices } from './services';
import { DefaultDocumentBuilder } from './documents/document-builder';
import { Connection } from 'vscode-languageserver/node';
import { DefaultLinker } from './references/linker';
import { DefaultScopeComputation, DefaultScopeProvider } from './references/scope';
import { DefaultNameProvider } from './references/naming';
import { ValidationRegistry } from './service/validation/validation-registry';
import { DefaultDocumentValidator } from './service/validation/document-validator';
import { AstJsonSerializer } from './service/json-serializer/ast-json-serializer';

export type DefaultModuleContext = {
    connection?: Connection
}

export function createDefaultModule(context: DefaultModuleContext = {}): Module<LangiumServices> {
    return {
        Parser: () => {
            throw new Error('Not implemented'); // TODO more helpful error message
        },
        GrammarAccess: () => {
            throw new Error('Not implemented'); // TODO more helpful error message
        },
        AstReflection: () => {
            throw new Error('Not implemented'); // TODO more helpful error message
        },

        documents: {
            DocumentBuilder: (injector) => new DefaultDocumentBuilder(injector)
        },
        languageServer: {
            Connection: () => context.connection
        },
        references: {
            Linker: (injector) => new DefaultLinker(injector),
            NameProvider: () => new DefaultNameProvider(),
            ScopeProvider: (injector) => new DefaultScopeProvider(injector),
            ScopeComputation: (injector) => new DefaultScopeComputation(injector)
        },
        validation: {
            DocumentValidator: (injector) => new DefaultDocumentValidator(injector),
            ValidationRegistry: (injector) => new ValidationRegistry(injector)
        },
        serializer: {
            JsonSerializer: (injector) => new AstJsonSerializer(injector)
        }
    };
}
