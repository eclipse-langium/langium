/******************************************************************************
 * Copyright 2022 TypeFox GmbH
 * This program and the accompanying materials are made available under the
 * terms of the MIT License, which is available in the project root.
 ******************************************************************************/
export function throttle<T>(milliseconds: number, action: (input: T) => void) {
  let timeout: NodeJS.Timeout | undefined = undefined;

  function clear() {
    if (timeout) {
      clearTimeout(timeout);
      timeout = undefined;
    }
  }

  return {
    clear,
    call: (input: T) => {
      clear();
      timeout = setTimeout(() => {
        action(input);
      }, milliseconds);
    },
  };
}