import { addMonacoStyles, MonacoEditorLanguageClientWrapper } from './bundleClassic/index.js';
import monarchSyntax from "./syntaxes/<%= language-id %>.monarch.js";
import { configureBaseServices, configureWorker } from './setup.js';

addMonacoStyles('monaco-editor-styles');

export const setupConfigClassic = (htmlElement) => {
    return {
        htmlElement: htmlElement,
        wrapperConfig: {
            serviceConfig: configureBaseServices(),
            editorAppConfig: {
                $type: 'classic',
                languageId: '<%= language-id %>',
                code: `// <%= RawLanguageName %> is running in the web!`,
                useDiffEditor: false,
                languageExtensionConfig: { id: 'langium' },
                languageDef: monarchSyntax,
                editorOptions: {
                    'semanticHighlighting.enabled': true,
                    theme: 'vs-dark'
                }
            }
        },
        languageClientConfig: configureWorker()
    };
};

export const executeClassic = async (htmlElement) => {
    const userConfig = setupConfigClassic(htmlElement);
    const wrapper = new MonacoEditorLanguageClientWrapper();
    await wrapper.start(userConfig);
};
