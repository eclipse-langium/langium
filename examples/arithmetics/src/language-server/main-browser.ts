/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { Diagnostic, Range } from 'vscode-languageserver/browser.js';
import { EmptyFileSystem, DocumentState } from 'langium';
import { startLanguageServer } from 'langium/lsp';
import { BrowserMessageReader, BrowserMessageWriter, createConnection, NotificationType } from 'vscode-languageserver/browser.js';
import { createArithmeticsServices } from './arithmetics-module.js';
import { interpretEvaluations } from './arithmetics-evaluator.js';
import type { Module } from './generated/ast.js';

/* browser specific setup code */
const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

// Inject the shared services and language-specific services
const { shared, arithmetics } = createArithmeticsServices({ connection, ...EmptyFileSystem });

// Start the language server with the shared services
startLanguageServer(shared);

// Send a notification with the serialized AST after every document change
type DocumentChange = { uri: string, content: string, diagnostics: Diagnostic[] };
const documentChangeNotification = new NotificationType<DocumentChange>('browser/DocumentChange');
const jsonSerializer = arithmetics.serializer.JsonSerializer;
shared.workspace.DocumentBuilder.onBuildPhase(DocumentState.Validated, documents => {
    for (const document of documents) {
        const json = [];
        const module = document.parseResult.value as Module;
        // create a json object with the all evaluations
        if(document.diagnostics === undefined  || document.diagnostics.filter((i) => i.severity === 1).length === 0) {
            for (const [evaluation, value] of interpretEvaluations(module)) {
                const cstNode = evaluation.expression.$cstNode;
                if (cstNode) {
                    json.push({range: evaluation.expression.$cstNode?.range, text: evaluation.expression.$cstNode?.text, value: value});
                }
            }
        }

        // add the evaluations to the ast object
        (module as unknown as { $evaluations: Array<{
            range: Range | undefined;
            text: string | undefined;
            value: number;
        }> }).$evaluations = json;
        connection.sendNotification(documentChangeNotification, {
            uri: document.uri.toString(),
            content: jsonSerializer.serialize(module, { sourceText: true, textRegions: true }),
            diagnostics: document.diagnostics ?? []
        });
    }
});
