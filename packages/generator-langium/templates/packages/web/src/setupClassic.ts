import { MonacoEditorLanguageClientWrapper, UserConfig } from 'monaco-editor-wrapper';
import { configureWorker, defineUserServices } from './setupCommon.js';
import { monarchSyntax } from '<%= language-id %>-language';

export const setupConfigClassic = (): UserConfig => {
    return {
        wrapperConfig: {
            serviceConfig: defineUserServices(),
            editorAppConfig: {
                $type: 'classic',
                codeResources: {
                    main: {
                        text: '// <%= RawLanguageName %> is running in the web!',
                        fileExt: '<%= file-glob-extension %>',
                        enforceLanguageId: '<%= language-id %>'
                    }
                },
                languageDef: {
                    languageExtensionConfig: { id: '<%= language-id %>' },
                    monarchLanguage: monarchSyntax
                },
                editorOptions: {
                    'semanticHighlighting.enabled': true,
                    theme: 'vs-dark'
                }
            }
        },
        languageClientConfig: configureWorker()
    };
};

export const executeClassic = async (htmlElement: HTMLElement) => {
    const userConfig = setupConfigClassic();
    const wrapper = new MonacoEditorLanguageClientWrapper();
    await wrapper.initAndStart(userConfig, htmlElement);
};
