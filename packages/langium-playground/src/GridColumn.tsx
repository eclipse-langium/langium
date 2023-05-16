import clsx from "clsx";
import React, { useEffect } from "react";

export interface GridColumnProps {
  index: number;
  title: string;
  buttons?: React.ReactNode;
  body: React.ReactNode;
  headerClassName?: string;
  bodyClassName?: string;
  mobile: boolean;
}

export const GridColumn: React.FC<GridColumnProps> = ({
  index,
  title,
  buttons,
  body,
  headerClassName,
  bodyClassName,
  mobile
}) => {
  return (
    <>
      <div
        className={clsx(
          headerClassName,
          "relative border-solid border flex items-center p-2 font-mono",
          {
            [`row-start-1 row-end-2 col-start-${index+1} col-end-${index+2}`]: !mobile,
            [`row-start-${index*2+1} row-end-${index*2+2} col-start-1 col-end-2`]: mobile,
          }
        )}
      >
        {title}
        {buttons}
      </div>
      <div
        className={clsx(
          bodyClassName,
          "border-solid border relative",
          {
            [`row-start-2 row-end-3 col-start-${index+1} col-end-${index+2}`]: !mobile,
            [`row-start-${index*2+2} row-end-${index*2+3} col-start-1 col-end-2`]: mobile,
          }
        )}
      >
        <div className="h-full absolute top-0 left-0 w-full">{body}</div>
      </div>
    </>
  );
};
