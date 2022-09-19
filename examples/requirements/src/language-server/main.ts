/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { startLanguageServer } from 'langium';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { createRequirementsAndTestsLanguageServices } from './requirements-and-tests-language-module';
import { NodeFileSystem } from 'langium/node';

// Create a connection to the client
const connection = createConnection(ProposedFeatures.all);

// Inject the shared services and language-specific services
const { shared } = createRequirementsAndTestsLanguageServices({ connection, ...NodeFileSystem });

// Start the language server with the shared services
startLanguageServer(shared);
