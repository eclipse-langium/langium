/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeEach, describe, expect, test } from 'vitest';
import { EmptyFileSystem } from 'langium';
import { createLangiumGrammarServices } from 'langium/grammar';

describe('ConfigurationProvider', () => {
    const grammarServices = createLangiumGrammarServices(EmptyFileSystem).grammar;
    const langId = grammarServices.LanguageMetaData.languageId;
    const configs = grammarServices.shared.workspace.ConfigurationProvider;
    beforeEach(() => {
        (configs as any).settings = {};
    });

    test('get missing settings', async () => {
        expect(await configs.getConfiguration(langId, 'missing')).toBeUndefined();
    });

    test('get existing settings', async () => {
        const settings: { [key: string]: any } = {};
        settings[langId] = { 'prop': 'foo' };
        configs.updateConfiguration({ settings });
        expect(await configs.getConfiguration(langId, 'prop')).toBe('foo');
    });

    test('update language settings', async () => {
        configs.updateConfiguration({ settings: { 'someLang': { 'prop': 'bar' } } });
        expect(await configs.getConfiguration('someLang', 'prop')).toBe('bar');

        configs.updateConfiguration({ settings: { 'someLang': { 'prop': 'bar2' } } });
        expect(await configs.getConfiguration('someLang', 'prop')).toBe('bar2');
    });

    test('emits `onConfigurationSectionUpdate` on `updateConfiguration` call', async () => {
        let called = false;
        configs.onConfigurationSectionUpdate(() => {
            called = true;
        });

        configs.updateConfiguration({ settings: { 'someLang': { 'prop': 'bar' } } });
        expect(called).toBe(true);
    });
});
