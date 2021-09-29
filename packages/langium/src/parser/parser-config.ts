/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import { IParserConfig } from 'chevrotain';

export { IParserConfig } from 'chevrotain';

export const defaultParserConfig: IParserConfig = {
    recoveryEnabled: true,
    nodeLocationTracking: 'onlyOffset'
};
