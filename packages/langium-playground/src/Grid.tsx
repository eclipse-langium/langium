import clsx from "clsx";
import React, { PropsWithChildren } from "react";

export interface GridProps {
  columns: number;
  className?: string;
  mobile: boolean;
}

export const Grid: React.FC<PropsWithChildren<GridProps>> = ({
  columns,
  className,
  children,
  mobile,
}) => {
  return (
    <div
      className={clsx(className, `grid relative`)}
      style={{
        gridTemplateRows: mobile ? `repeat(${columns}, 3rem 50%)` : "3rem auto",
        gridTemplateColumns: mobile ? "auto" : `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {children}
    </div>
  );
};