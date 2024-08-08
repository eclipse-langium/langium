/******************************************************************************
 * Copyright 2023 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';
import { parentPort } from 'node:worker_threads';

const services = createLangiumGrammarServices(EmptyFileSystem).grammar;
const parser = services.parser.LangiumParser;
const hydrator = services.serializer.Hydrator;

parentPort.on('message', text => {
    const result = parser.parse(text);
    const dehydrated = hydrator.dehydrate(result);
    parentPort.postMessage(dehydrated);
});
