/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Mutable } from './ast-util.js';
import type { Module } from '../dependency-injection.js';
import type { LangiumServices, LangiumSharedServices, PartialLangiumServices, PartialLangiumSharedServices } from '../services.js';
import * as ast from '../grammar/generated/ast.js';
import { inject } from '../dependency-injection.js';
import { createDefaultModule, createDefaultSharedModule } from '../default-module.js';
import { EmptyFileSystem } from '../workspace/file-system-provider.js';
import { URI } from './uri-util.js';

const minimalGrammarModule: Module<LangiumServices, PartialLangiumServices> = {
    Grammar: () => undefined as unknown as ast.Grammar,
    LanguageMetaData: () => ({
        caseInsensitive: false,
        fileExtensions: ['.langium'],
        languageId: 'langium'
    })
};

const minimalSharedGrammarModule: Module<LangiumSharedServices, PartialLangiumSharedServices> = {
    AstReflection: () => new ast.LangiumGrammarAstReflection()
};

function createMinimalGrammarServices(): LangiumServices {
    const shared = inject(
        createDefaultSharedModule(EmptyFileSystem),
        minimalSharedGrammarModule
    );
    const grammar = inject(
        createDefaultModule({ shared }),
        minimalGrammarModule
    );
    shared.ServiceRegistry.register(grammar);
    return grammar;
}

/**
 * Load a Langium grammar for your language from a JSON string. This is used by several services,
 * most notably the parser builder which interprets the grammar to create a parser.
 */
export function loadGrammarFromJson(json: string): ast.Grammar {
    const services = createMinimalGrammarServices();
    const astNode = services.serializer.JsonSerializer.deserialize(json) as Mutable<ast.Grammar>;
    services.shared.workspace.LangiumDocumentFactory.fromModel(astNode, URI.parse(`memory://${astNode.name ?? 'grammar'}.langium`));
    return astNode;
}
