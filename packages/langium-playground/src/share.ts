import { compressToEncodedURIComponent } from "lz-string";

export function toUrl(grammar: string, content: string): string {
  const compressedGrammar = compressToEncodedURIComponent(grammar);
  const compressedContent = compressToEncodedURIComponent(content);
  const url = new URL("/playground", window.origin);
  url.searchParams.append("grammar", compressedGrammar);
  url.searchParams.append("content", compressedContent);
  return url.toString();
}
