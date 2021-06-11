/**********************************************************************************
 * Copyright (c) 2021 TypeFox
 *
 * This program and the accompanying materials are made available under the terms
 * of the MIT License, which is available at https://opensource.org/licenses/MIT.
 *
 * SPDX-License-Identifier: MIT
 **********************************************************************************/

export interface Package {
    name: string,
    version: string,
    langium: LangiumConfig
}

export interface LangiumConfig {
    grammar?: string,
    extensions?: string[],
    out?: string,
    // The following option is meant to be used only by Langium itself
    langiumInternal?: boolean
}
