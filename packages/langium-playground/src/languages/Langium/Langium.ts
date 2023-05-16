import { Language } from "../../PlaygroundEditor";

const LangiumLanguage: Language = {
    id: "langium",
    workerUrl: new URL("generated/langium.worker.js"),
    configurationJsonContent: '',
    grammarJsonContent: ''
};


export default LangiumLanguage;