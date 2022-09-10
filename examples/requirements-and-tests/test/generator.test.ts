import { extractRequirementModelWithTestModels } from '../src/cli/cli-util'
import { generateSummaryFileHTMLContent } from '../src/cli/generator'
import { createRequirementsAndTestsLanguageServices } from '../src/language-server/requirements-and-tests-language-module'
import * as path from 'path'

describe('The generator should allow to extract all test cases referencing a specific requirement.', () => {
    test('T005_generator', async () => {
        // load model
        const services = createRequirementsAndTestsLanguageServices();
        const [requirementModel, testModels]  = await extractRequirementModelWithTestModels(
            path.join(__dirname, "files", "good", "requirements.req"),
            services.RequirementsLanguage
        );
        
        // generate summary
        const html = generateSummaryFileHTMLContent(requirementModel, testModels);
        const table = new RegExp(/[^]*<table[^>]*>([^]*)<\/table>[^]*/gm).exec(html);
        expect(table).toBeDefined();
        if (!table) throw new Error("unexpected");
        expect(table.length).toBe(2);
        const rows = table[1].replace(/[\n\r]/g," ").split("</TR>");
        const relevantRows = rows.slice(
            1, // delete last part (after last </TR>)
            rows.length-1 // delete first part (heading)
        );
        
        expect(relevantRows.length).toBe(4);
        expect(relevantRows).toStrictEqual(expect.arrayContaining([
            expect.stringMatching(new RegExp(".*ReqId000.*T005_generator.*"))
        ]))
        expect(relevantRows).not.toStrictEqual(expect.arrayContaining([
            expect.stringMatching(new RegExp(".*ReqId001_tstID.*T005_generator.*"))
        ]))

        expect(relevantRows).toStrictEqual(expect.arrayContaining([
            expect.stringMatching(new RegExp(".*ReqId001_tstID.*T001_good_case.*"))
        ]))
        expect(relevantRows).toStrictEqual(expect.arrayContaining([
            expect.stringMatching(new RegExp(".*ReqId001_tstID.*T003_badTstId.*"))
        ]))

        expect(relevantRows).toStrictEqual(expect.arrayContaining([
            expect.stringMatching(new RegExp(".*ReqId002_reqID.*T001_good_case.*"))
        ]))
        expect(relevantRows).toStrictEqual(expect.arrayContaining([
            expect.stringMatching(new RegExp(".*ReqId002_reqID.*T002_badReqId.*"))
        ]))

    })
});
