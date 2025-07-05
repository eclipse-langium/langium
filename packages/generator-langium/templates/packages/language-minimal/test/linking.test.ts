import { describe } from "vitest";

/*
let services: ReturnType<typeof create<%= LanguageName %>Services>;
let parse:    ReturnType<typeof parseHelper<<%= EntryName %>>>;
let document: LangiumDocument<<%= EntryName %>> | undefined;

beforeAll(async () => {
    services = create<%= LanguageName %>Services(EmptyFileSystem);
    parse = parseHelper<<%= EntryName %>>(services.<%= LanguageName %>);

    // activate the following if your linking test requires elements from a built-in library, for example
    // await services.shared.workspace.WorkspaceManager.initializeWorkspace([]);
});

afterEach(async () => {
    document && clearDocuments(services.shared, [ document ]);
});
*/

describe('Linking tests', () => {

    // TODO: Add linking tests
});
