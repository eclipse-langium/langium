/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { startLanguageServer } from 'langium';
import { createConnection, ProposedFeatures } from 'vscode-languageserver/node';
import { createDomainModelServices } from './domain-model-module';

const connection = createConnection(ProposedFeatures.all);
const allServices = createDomainModelServices({ connection });
startLanguageServer(allServices);
