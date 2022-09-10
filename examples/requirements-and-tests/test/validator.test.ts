import { extractDocuments } from '../src/cli/cli-util'
import { createRequirementsAndTestsLanguageServices } from '../src/language-server/requirements-and-tests-language-module'
import * as path from 'path'

describe('A requirement identifier and a test identifier shall contain a number.', () => {
    test('T001_good_case', async () => {
        const services = createRequirementsAndTestsLanguageServices();
        const [mainDoc,allDocs] = await extractDocuments(
            path.join(__dirname, "files", "good", "requirements.req"),
            services.RequirementsLanguage
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
        const services = createRequirementsAndTestsLanguageServices();
        const [mainDoc,] = await extractDocuments(
            path.join(__dirname, "files", "bad", "requirements.req"),
            services.RequirementsLanguage
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
        const services = createRequirementsAndTestsLanguageServices();
        const [,allDocs] = await extractDocuments(
            path.join(__dirname, "files", "bad", "requirements.req"),
            services.RequirementsLanguage
        );
        const doc = allDocs.find(doc=>/tests_part1.tst/.test(doc.uri.fsPath));
        expect(doc).toBeDefined();
        if (!doc) throw new Error("impossible");        
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
        const services = createRequirementsAndTestsLanguageServices();
        const [mainDoc,] = await extractDocuments(
            path.join(__dirname, "files", "bad", "requirements.req"),
            services.RequirementsLanguage
        );
        expect(mainDoc.diagnostics ?? []).toEqual(expect.arrayContaining([
            expect.objectContaining({
                message: expect.stringMatching('Requirement ReqId004_unicorn not covered by a test.'),
                range: expect.objectContaining({start:expect.objectContaining({line: 4})}) // zero based
            })
        ]));
    });
});
