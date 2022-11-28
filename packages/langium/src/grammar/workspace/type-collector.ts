/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { LangiumDocuments } from '../../workspace/documents';
import { Grammar } from '../generated/ast';

export class LangiumGrammarTypeCollector {
    collectAst(_documents: LangiumDocuments, _grammars: Grammar[]) {
        console.log('TEST');
    }
}
