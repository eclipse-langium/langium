import React, { FC, useEffect, useState } from "react";
import styles from "./input.module.css";
import { Grid } from "./Grid";
import { GridColumn } from "./GridColumn";
import clsx from "clsx";
import { MonacoEditorReactComp } from "@typefox/monaco-editor-react/.";
import { PlaygroundEditor } from "./PlaygroundEditor";
import LangiumLanguage from "./languages/Langium/Langium";

export interface PlaygroundProps {
  onCopy: (grammar: string, content: string) => string;
}

export const Playground: FC<PlaygroundProps> = ({ onCopy }) => {
  const [grammarText, setGrammarText] = useState(() => "");
  const [content, setContent] = useState(() => "");
  const [showTree, setShowTree] = useState(false);
  const [hintHidden, setHintHidden] = useState(true);
  const [viewIsMobile, setViewisMobile] = useState(false);

  useEffect(() => {
    const listener = ({matches}: {matches: boolean}) => {
      setViewisMobile(matches);
    };
    
    const mediaQueryList = window.matchMedia("screen and (max-width: 600px), screen and (max-height: 400px)");
    listener({
      matches: mediaQueryList.matches
    });
    mediaQueryList.addEventListener("change", listener);
    return () => mediaQueryList.removeEventListener("change", listener);
  }, []);

  return (
    <Grid className={styles.grid} columns={showTree ? 3 : 2} mobile={viewIsMobile}>
      <GridColumn
        headerClassName={styles.header}
        bodyClassName={styles.body}
        mobile={viewIsMobile}
        index={1}
        title="Grammar"
        body={<PlaygroundEditor text={grammarText} onTextChanged={setGrammarText} language={LangiumLanguage}/>}
      />
      <GridColumn
        headerClassName={styles.header}
        bodyClassName={styles.body}
        mobile={viewIsMobile}
        index={2}
        title="Content"
        buttons={
          <>
            <img
              className="inline w-4 h-4 cursor-pointer absolute right-2"
              src="/tree.svg"
              title="Toggle syntax tree view"
              onClick={() => setShowTree(!showTree)}
            />
            <img
              className="inline w-4 h-4 cursor-pointer absolute right-8"
              src="/share.svg"
              title="Copy URL to this grammar and content"
              onClick={() => {
                setHintHidden(false);
                navigator.clipboard.writeText(onCopy(grammarText, content));
                setTimeout(() => {
                  setHintHidden(true);
                }, 2000);
              }}
            />
            <span
              className={clsx(`align-baseline text-xs right-14 absolute`, {'hidden': hintHidden})}
            >
              Link was copied!
            </span>
          </>
        }
        body={<>BBB</>}
      />
     {showTree && <GridColumn
        headerClassName={styles.header}
        bodyClassName={styles.body}
        mobile={viewIsMobile}
        index={3}
        title="Syntax tree"
        body={<>CCC</>}
      />}
    </Grid>
  );
};
