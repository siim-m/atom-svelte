import { flushSync } from "svelte";

export const text = (testId: string): string | null =>
  document.querySelector(`[data-testid="${testId}"]`)?.textContent ?? null;

export const click = (testId: string): void => {
  const element = document.querySelector<HTMLButtonElement>(`[data-testid="${testId}"]`);
  if (element === null) {
    throw new Error(`Missing test button: ${testId}`);
  }
  element.click();
  flushSync();
};
