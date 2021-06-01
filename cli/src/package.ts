
export interface Package {
    name: string,
    version: string,
    langium: LangiumConfig
}

export interface LangiumConfig {
    grammar?: string,
    extension?: string,
    name?: string,
    out?: string,
    // The following option is meant to be used only by Langium itself
    langiumInternal?: boolean
}
