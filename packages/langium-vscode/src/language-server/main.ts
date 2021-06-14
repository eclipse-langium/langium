/**********************************************************************************
 * Copyright (c) 2021 TypeFox
 *
 * This program and the accompanying materials are made available under the terms
 * of the MIT License, which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

import { createLangiumGrammarServices, startLanguageServer } from 'langium';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';

const connection = createConnection(ProposedFeatures.all);
const services = createLangiumGrammarServices({ connection });
startLanguageServer(services);
