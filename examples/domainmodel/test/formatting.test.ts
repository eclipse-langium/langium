/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { describe, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { expectFormatting } from 'langium/test';
import { createDomainModelServices } from '../src/language-server/domain-model-module.js';

const services = createDomainModelServices({ ...EmptyFileSystem }).domainmodel;
const formatting = expectFormatting(services);

describe('Domain model formatting', () => {

    test('Should create newline formatting', async () => {
        await formatting({
            before: 'package foo.bar { datatype Complex entity E2 extends E1 { next: E2 other: Complex nested: Complex time: Complex }}',
            after: `package foo.bar {
    datatype Complex
    entity E2 extends E1 {
        next: E2
        other: Complex
        nested: Complex
        time: Complex
    }
}`
        });
    });

    test('Should indent comments correctly', async () => {
        await formatting({
            before: `package foo.bar {
        /**
         * This is a comment
         */
    datatype Complex
}`,
            after: `package foo.bar {
    /**
     * This is a comment
     */
    datatype Complex
}`
        });
    });

});
