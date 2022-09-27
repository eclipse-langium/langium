/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { extractDocuments } from '../src/cli/cli-util';
import { createRequirementsAndTestsLangServices } from '../src/language-server/requirements-and-tests-lang-module';
import * as path from 'path';
import { NodeFileSystem } from 'langium/node';

describe('A requirement identifier and a test identifier shall contain a number.', () => {
    test('T001_good_case', async () => {
        const services = createRequirementsAndTestsLangServices(NodeFileSystem);
        const [mainDoc,allDocs] = await extractDocuments(
            path.join(__dirname, 'files', 'good', 'requirements.req'),
            services.RequirementsLang
        );
        expect((mainDoc.diagnostics ?? [])).toEqual([]);
        expect(allDocs.length).toEqual(3);
        allDocs.forEach(doc=>{
            expect((doc.diagnostics ?? [])).toEqual([]);
        });
    });
});

describe('A requirement identifier shall contain a number.', () => {
    test('T002_badReqId: bad case', async () => {
        const services = createRequirementsAndTestsLangServices(NodeFileSystem);
        const [mainDoc,] = await extractDocuments(
            path.join(__dirname, 'files', 'bad1', 'requirements.req'),
            services.RequirementsLang
        );
        expect(mainDoc.diagnostics ?? []).toEqual(expect.arrayContaining([
            expect.objectContaining({
                message: expect.stringMatching('Requirement name ReqIdABC_reqID should container a number'),
                range: expect.objectContaining({start:expect.objectContaining({line: 2})}) // zero based
            })
        ]));

    });
});

describe('A test identifier shall contain a number.', () => {
    test('T003_badTstId: bad case', async () => {
        const services = createRequirementsAndTestsLangServices(NodeFileSystem);
        const [,allDocs] = await extractDocuments(
            path.join(__dirname, 'files', 'bad1', 'requirements.req'),
            services.RequirementsLang
        );
        const doc = allDocs.find(doc=>/tests_part1.tst/.test(doc.uri.fsPath));
        expect(doc).toBeDefined();
        if (!doc) throw new Error('impossible');
        expect(doc.diagnostics ?? []).toEqual(expect.arrayContaining([
            expect.objectContaining({
                message: expect.stringMatching('Test name TA should container a number.'),
                range: expect.objectContaining({start:expect.objectContaining({line: 1})}) // zero based
            })
        ]));
    });
});

describe('A requirement shall be covered by at least one test.', () => {
    test('T004_cov: bad case', async () => {
        const services = createRequirementsAndTestsLangServices(NodeFileSystem);
        const [mainDoc,] = await extractDocuments(
            path.join(__dirname, 'files', 'bad1', 'requirements.req'),
            services.RequirementsLang
        );
        expect(mainDoc.diagnostics ?? []).toEqual(expect.arrayContaining([
            expect.objectContaining({
                message: expect.stringMatching('Requirement ReqId004_unicorn not covered by a test.'),
                range: expect.objectContaining({start:expect.objectContaining({line: 4})}) // zero based
            })
        ]));
    });
});

describe('A referenced environment in a test must be found in one of the referenced requirements.', () => {
    test('referenced environment test', async () => {
        const services = createRequirementsAndTestsLangServices(NodeFileSystem);
        const [,allDocs] = await extractDocuments(
            path.join(__dirname, 'files', 'bad2', 'requirements.req'),
            services.RequirementsLang
        );
        const doc = allDocs.find(doc=>/tests_part1.tst/.test(doc.uri.fsPath));
        expect(doc).toBeDefined();
        if (!doc) throw new Error('impossible');
        expect((doc.diagnostics ?? [])).toEqual(expect.arrayContaining([
            expect.objectContaining({
                message: expect.stringMatching('Test T002_badReqId references environment Linux_x86 which is used in any referenced requirement.'),
                range: expect.objectContaining({start:expect.objectContaining({
                    line: 3,
                    character: 65
                })}) // zero based
            })
        ]));
        expect((doc.diagnostics ?? [])).toEqual(expect.arrayContaining([
            expect.objectContaining({
                message: expect.stringMatching('Test T004_cov references environment Linux_x86 which is used in any referenced requirement.'),
                range: expect.objectContaining({start:expect.objectContaining({
                    line: 5
                })}) // zero based
            })
        ]));

    });
});
