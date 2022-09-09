import fs from 'fs';
import { CompositeGeneratorNode, NL, processGeneratorNode } from 'langium';
import path from 'path';
import { RequirementModel, TestModel } from '../language-server/generated/ast';
import { extractDestinationAndName } from './cli-util';

export function generateSummary(model: RequirementModel, testModels: TestModel[], filePath: string, destination: string | undefined): string {
    const data = extractDestinationAndName(filePath, destination);
    const generatedFilePath = `${path.join(data.destination, data.name)}.html`;

    const fileNode = new CompositeGeneratorNode();
    fileNode.append('<html>', NL);
    fileNode.append('<body>', NL);
    fileNode.append('<h1>Requirement coverage (demo generator)</h1>', NL);
    fileNode.append(`<div>Source: ${model.$document?.uri.fsPath}</div>`, NL);
    fileNode.append('<table border="1">', NL);
    fileNode.append(`<TR><TH>Requirement ID</TH><TH>Testcase ID</TH></TR>`, NL)
    model.requirements.forEach(requirement => {
        fileNode.append(`<TR><TD>${requirement.name}</TD><TD>`, NL)
        testModels.forEach(testModel=>testModel.tests.forEach(test=>{
            if (test.requirements.map(r=>r.ref).includes(requirement)) {
                fileNode.append(`<div>${test.name} (from ${testModel.$document?.uri.fsPath})<div>`, NL)
            }
        }));
        fileNode.append(`</TD></TR>`, NL)
    });
    fileNode.append('</table>', NL);
    fileNode.append('</body>', NL);
    fileNode.append('</html>', NL);

    if (!fs.existsSync(data.destination)) {
        fs.mkdirSync(data.destination, { recursive: true });
    }
    fs.writeFileSync(generatedFilePath, processGeneratorNode(fileNode));
    return generatedFilePath;
}
