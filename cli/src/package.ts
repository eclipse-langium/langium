
export interface Package {
    name: string,
    version: string,
    langium: LangiumConfig
}

export interface LangiumConfig {
    grammar?: string,
    extension?: string,
    name?: string,
    path?: string,
    out?: string
}