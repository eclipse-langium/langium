/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { startLanguageServer } from 'langium/lsp';
import { NodeFileSystem } from 'langium/node';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node.js';
import { createArithmeticsServices } from './arithmetics-module.js';

const connection = createConnection(ProposedFeatures.all);

const { shared } = createArithmeticsServices({ connection, ...NodeFileSystem });

startLanguageServer(shared);
