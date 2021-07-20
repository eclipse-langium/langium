/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

export interface Package {
    name: string,
    version: string,
    langium: LangiumConfig
}

export interface LangiumConfig {
    /** The identifier of your language as used in vscode */
    languageId?: string
    /** Path to the grammar file */
    grammar?: string
    /** File extensions with leading `.` */
    fileExtensions?: string[]
    /** Main output directory for TypeScript code */
    out?: string
    /** Enable generating a TextMate syntax highlighting file */
    textMate?: {
        /** Output path to syntax highlighting file */
        out: string
    }
    /** The following option is meant to be used only by Langium itself */
    langiumInternal?: boolean
}
