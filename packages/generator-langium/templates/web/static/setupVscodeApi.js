import { addMonacoStyles, defineUserServices, whenReadyTheme, MonacoEditorLanguageClientWrapper } from './bundleVscodeApi/index.js';
import { configureWorker } from './setup.js';

addMonacoStyles('monaco-editor-styles');

export const setupConfigVscodeApi = () => {
    const extensionFilesOrContents = new Map();
    const languageConfigUrl = new URL('../language-configuration.json', window.location.href);
    const textmateConfigUrl = new URL('./syntaxes/<%= language-id %>.tmLanguage.json', window.location.href);
    extensionFilesOrContents.set('/language-configuration.json', languageConfigUrl);
    extensionFilesOrContents.set('/<%= language-id %>-grammar.json', textmateConfigUrl);

    return {
        wrapperConfig: {
            serviceConfig: defineUserServices(),
            editorAppConfig: {
                $type: 'vscodeApi',
                languageId: '<%= language-id %>',
                code: `// <%= RawLanguageName %> is running in the web!`,
                useDiffEditor: false,
                awaitExtensionReadiness: [whenReadyTheme],
                extensions: [{
                    config: {
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
                    filesOrContents: extensionFilesOrContents,
                }],                
                userConfiguration: {
                    json: JSON.stringify({
                        'workbench.colorTheme': 'Default Dark Modern',
                        'editor.semanticHighlighting.enabled': true
                    })
                }
            }
        },
        languageClientConfig: configureWorker()
    };
};

export const executeVscodeApi = async (htmlElement) => {
    const userConfig = setupConfigVscodeApi();
    const wrapper = new MonacoEditorLanguageClientWrapper();
    await wrapper.start(userConfig, htmlElement);
};
