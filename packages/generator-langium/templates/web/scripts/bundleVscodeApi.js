import { Uri } from 'vscode';
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override';
import getTextmateServiceOverride from '@codingame/monaco-vscode-textmate-service-override';
import { whenReady as whenReadyTheme } from '@codingame/monaco-vscode-theme-defaults-default-extension';
import { useOpenEditorStub } from 'monaco-languageclient';
import { 
    getConfigurationServiceOverride,
    getEditorServiceOverride,
    getKeybindingsServiceOverride,
    addMonacoStyles,
    MonacoEditorLanguageClientWrapper
} from './bundleClassic.js';

export const defineUserServices = () => {
    return {
        userServices: {
            ...getThemeServiceOverride(),
            ...getTextmateServiceOverride(),
            ...getConfigurationServiceOverride(Uri.file('/workspace')),
            ...getEditorServiceOverride(useOpenEditorStub),
            ...getKeybindingsServiceOverride()
        },
        debugLogging: true
    }
};
export {
    whenReadyTheme,
    addMonacoStyles,
    MonacoEditorLanguageClientWrapper
};
