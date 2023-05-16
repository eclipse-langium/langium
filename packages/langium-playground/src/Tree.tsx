/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/

import React, { FC, useState } from "react";
import { PropertyNode, ValueNode } from "./preprocess";
import { clsx } from "clsx";

export interface TreeProps {
  root: ValueNode;
  hidden: boolean;
}

export const TreeContent: FC<TreeProps> = ({ root, hidden }) => {
  switch (root.kind) {
    case "undefined":
      return (
        <span className="undefined">
          undefined
        </span>
      );
    case "boolean":
    case "number":
    case "string":
      return (
          <span className="literal">
            {hidden
              ? "..."
              : root.kind === "string"
              ? '"' + root.value + '"'
              : root.value.toString()}
          </span>
      );
    case "object":
      return (
        <>
          <span className="object">
            {hidden ? (
              <span className="opening-brace">&#123;...&#125;</span>
            ) : (
              <>
                <div className="opening-brace">&#123;</div>
                <ul className="object-body">
                  {root.properties.map((p, index) => (
                    <Property
                      key={index}
                      p={p}
                      comma={index !== root.properties.length - 1}
                    />
                  ))}
                </ul>
                <span className="closing-brace">&#125;</span>
              </>
            )}
          </span>
        </>
      );
    case "array":
      if(root.children.length === 0) {
        return <span className="opening-brace">{"[]"}</span>
      }
      if(hidden) {
        return <span className="opening-brace">{"[...]"}</span>
      }
      return (
        <>
          <div className="opening-brace">[</div>
          <ul className="object-body">
            {root.children.map((c, index) => (
              <li
                key={index}
                className={clsx("entry toggable", {
                  closed: hidden,
                })}
              >
                <TreeContent root={c} hidden={false} />
                {index !== root.children.length - 1 && (
                  <span className="comma">,&nbsp;</span>
                )}
              </li>
            ))}
          </ul>
          <span className="closing-brace inline">]</span>
        </>
      );
    case "reference":
      return (
        <>
          {hidden ? <span className="link">{"Reference(...)"}</span> :
          <span className="link">Reference('{root.$text}')</span>}
        </>
      );
  }
  return <div>???</div>;
};

const TreeNode: FC<TreeProps> = ({ root, hidden }) => {
  return (
    <li className="inline entry">
      <TreeContent root={root} hidden={hidden} />
    </li>
  );
};

function Property({ p, comma }: { p: PropertyNode; comma: boolean }) {
  const [open, setOpen] = useState(true);
  return (
    <li className={clsx("entry toggable", { closed: !open })}>
      <span className={"value"}>
        <span className="text-[#d4d4d4] cursor-pointer" onClick={() => setOpen((p) => !p)}>
          {p.name}
        </span>
        <span className="text-[#d4d4d4]">:&nbsp;</span>
        <ul className="inline">
          <TreeNode root={p.type} hidden={!open} />
        </ul>
      </span>
      {comma && <span className="text-[#d4d4d4]">,&nbsp;</span>}
    </li>
  );
}
