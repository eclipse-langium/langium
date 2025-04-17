/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { expandToNode, joinToNode, toString } from 'langium/generate';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { RequirementModel, TestModel } from '../language-server/generated/ast.js';
import { extractDestinationAndName } from './cli-util.js';

/**
 * main generator function: generate a summary in HTML.
 * @param model the model with requirements
 * @param testModels the models with test cases
 * @returns the content of the HTML file.
 */
export function generateSummaryFileHTMLContent(model: RequirementModel, testModels: TestModel[]): string {
    return toString(
        expandToNode`
            <html>
            <body>
            <h1>Requirement coverage (demo generator)</h1>
            <div>Source: ${model.$document?.uri.fsPath}</div>
            <table border="1">
            <TR><TH>Requirement ID</TH><TH>Testcase ID</TH></TR>
            ${joinToNode(
                model.requirements,
                requirement => expandToNode`
                    <TR><TD>${requirement.name}</TD><TD>
                    ${joinToNode(
                        testModels.flatMap(testModel => testModel.tests.map(test => ({ testModel, test }))).filter( ({ test }) => test.requirements.map(r => r.ref).includes(requirement) ),
                        ({ testModel, test }) => `<div>${test.name} (from ${testModel.$document?.uri?.fsPath})<div>`,
                        { appendNewLineIfNotEmpty: true }
                    )}
                    </TD></TR>
                `,
                { appendNewLineIfNotEmpty: true }
            )}
            </table>
            </body>
            </html>
        `.appendNewLine()
    );
}

export function generateSummary(model: RequirementModel, testModels: TestModel[], filePath: string, destination: string | undefined): string {
    const data = extractDestinationAndName(filePath, destination);
    const generatedFilePath = `${path.join(data.destination, data.name)}.html`;

    if (!fs.existsSync(data.destination)) {
        fs.mkdirSync(data.destination, { recursive: true });
    }
    fs.writeFileSync(generatedFilePath, generateSummaryFileHTMLContent(model, testModels));
    return generatedFilePath;
}
