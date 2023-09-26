import { addMonacoStyles, MonacoEditorLanguageClientWrapper } from './bundleVscodeApi/index.js';
import { configureBaseServices, configureWorker } from './setup.js';

addMonacoStyles('monaco-editor-styles');

export const setupConfigVscodeApi = (htmlElement) => {
    const baseServices = configureBaseServices();
    baseServices.enableTextmateService = true;
    baseServices.enableThemeService = true;

    const extensionFilesOrContents = new Map();
    const languageConfigUrl = new URL('../language-configuration.json', window.location.href);
    const textmateConfigUrl = new URL('./syntaxes/<%= language-id %>.tmLanguage.json', window.location.href);
    extensionFilesOrContents.set('/language-configuration.json', languageConfigUrl);
    extensionFilesOrContents.set('/<%= language-id %>-grammar.json', textmateConfigUrl);

    return {
        htmlElement: htmlElement,
        wrapperConfig: {
            serviceConfig: baseServices,
            editorAppConfig: {
                $type: 'vscodeApi',
                languageId: '<%= language-id %>',
                code: `// <%= RawLanguageName %> is running in the web!`,
                useDiffEditor: false,
                extension: {
                    name: '<%= language-id %>-web',
                    publisher: 'generator-langium',
                    version: '1.0.0',
                    engines: {
                        vscode: '*'
                    },
                    contributes: {
                        languages: [{
                            id: '<%= language-id %>',
                            extensions: [
                                '.<%= language-id %>'
                            ],
                            configuration: './language-configuration.json'
                        }],
                        grammars: [{
                            language: '<%= language-id %>',
                            scopeName: 'source.<%= language-id %>',
                            path: './<%= language-id %>-grammar.json'
                        }]
                    }
                },
                extensionFilesOrContents: extensionFilesOrContents,
                userConfiguration: {
                    json: `{
    "workbench.colorTheme": "Default Dark Modern",
    "editor.semanticHighlighting.enabled": true
}`
                }
            }
        },
        languageClientConfig: configureWorker()
    };
};

export const executeVscodeApi = async (htmlElement) => {
    const userConfig = setupConfigVscodeApi(htmlElement);
    const wrapper = new MonacoEditorLanguageClientWrapper();
    await wrapper.start(userConfig);
};
