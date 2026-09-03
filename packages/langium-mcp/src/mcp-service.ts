/******************************************************************************
 * Copyright 2026 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { URI, type LangiumSharedCoreServices } from 'langium';

export interface McpService {
    createServer(): McpServer;
}

export interface McpServiceOptions {
    name: string;
    version: string;
}

export class DefaultMcpService implements McpService {

    protected readonly services: LangiumSharedCoreServices;
    protected readonly options: McpServiceOptions;

    constructor(services: LangiumSharedCoreServices, options: McpServiceOptions) {
        this.services = services;
        this.options = options;
    }

    createServer(): McpServer {
        const server = new McpServer({
            name: this.options.name,
            version: this.options.version
        });
        // Register a tool for retrieving diagnostics from the language server
        this.registerDiagnosticsTool(server);
        return server;
    }

    protected registerDiagnosticsTool(server: McpServer): void {
        server.registerTool('get-diagnostics', {
            title: 'Get Diagnostics',
            description: 'Retrieves diagnostics from the language server for all files in the given directory, ordered by file.',
            inputSchema: z.object({
                directory: z.string().optional(),
            })
        }, async ({ directory }) => {
            await this.services.workspace.WorkspaceManager.ready;
            const severities = ['error', 'warning', 'information', 'hint'];
            const lines: string[] = [];
            // Wrap the diagnostics read in a lock, to ensure that the workspace build is already done
            await this.services.workspace.WorkspaceLock.read(() => {
                const documentManager = this.services.workspace.LangiumDocuments;
                const documents = directory ? documentManager.getDocuments(URI.file(directory)) : documentManager.all.toArray();
                for (const doc of documents) {
                    if (doc.diagnostics && doc.diagnostics.length > 0) {
                        lines.push(doc.uri.toString());
                        for (const diag of doc.diagnostics) {
                            const severity = diag.severity ? severities[diag.severity - 1] : undefined;
                            const source = diag.source ? ` (${diag.source})` : '';
                            lines.push(`[${severity ?? 'unknown'} at ${diag.range.start.line + 1}:${diag.range.start.character + 1}] ${diag.message}${source}`);
                        }
                    }
                }
            });
            return {
                content: [{
                    type: 'text',
                    text: lines.join('\n') || 'No diagnostics found.'
                }]
            };
        });
    }
}
