/******************************************************************************
 * Copyright 2021 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import type { IParserConfig } from 'langium';
import type { LangiumGrammarValidationOptions } from 'langium/grammar';

export interface Package {
    name: string
    version: string
    langium: LangiumConfig
}

export const RelativePath = Symbol('RelativePath');

export interface LangiumConfig {
    /** Relative path to the directory of the config */
    [RelativePath]: string
    /** Name of the language project */
    projectName: string
    /** Array of language configurations */
    languages: LangiumLanguageConfig[]
    /** Main output directory for TypeScript code */
    out?: string
    /** File extension for import statements of generated files */
    importExtension?: string
    /** Mode used to generate optimized files for development or production environments */
    mode?: 'development' | 'production';
    /** Options for grammar validation */
    validation?: LangiumGrammarValidationOptions
    /** Configure the chevrotain parser for all languages */
    chevrotainParserConfig?: IParserConfig,
    /** The following option is meant to be used only by Langium itself */
    langiumInternal?: boolean
}

export interface LangiumLanguageConfig {
    /** The identifier of your language as used in vscode */
    id: string
    /** Path to the grammar file */
    grammar: string
    /** File extensions with leading `.` */
    fileExtensions?: string[]
    /** File names */
    fileNames?: string[]
    /** Enable case-insensitive keywords parsing */
    caseInsensitive?: boolean
    /** Enable generating a TextMate syntax highlighting file */
    textMate?: {
        /** Output path to syntax highlighting file */
        out: string
    }
    /** Enable generating a Monarch syntax highlighting file */
    monarch?: {
        /** Output path to syntax highlighting file */
        out: string
    }
    /** Enable generating a Prism syntax highlighting file */
    prism?: {
        /** Output path to syntax highlighting file */
        out: string
    }
    /** Enable generating railroad syntax diagrams */
    railroad?: {
        /** Output path for railroad diagrams */
        out: string;
        /** Whether to print diagrams all into a single html file or in separate svg files */
        mode?: 'html' | 'svg';
        /** Path to a css file that will be included in the generated output files */
        css?: string;
    }
    /** Configure the chevrotain parser for a single language */
    chevrotainParserConfig?: IParserConfig
    /** Enable BNF file generation */
    bnf?: {
        /** Output path for the BNF file */
        out: string,
        /** Dialect of the generated BNF file. GBNF is the default. In EBNF RegEx terminals are not supported. */
        dialect?: 'GBNF' | 'EBNF',
        /**
         * By default, comments are generated according to the dialect. GBNF uses `#`, EBNF uses `(* *)`.
         * Use this option to force a specific comment style. Use `parentheses` for `(* comment *)`, `slash` for `/* comment *\/`,
         * `hash` for `# comment` and `skip` to disable comment generation.
         */
        comment?: 'skip' | 'parentheses' | 'slash' | 'hash'
    }
}
