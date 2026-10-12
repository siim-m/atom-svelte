import { flushSync, tick } from "svelte";

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

const getInput = (testId: string): HTMLInputElement => {
  const element = document.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`);
  if (element === null) {
    throw new Error(`Missing test input: ${testId}`);
  }
  return element;
};

export const inputValue = (testId: string): string => getInput(testId).value;

// Svelte's bind:value reads the bound value again one tick after an input event.
export const enterText = async (testId: string, value: string): Promise<void> => {
  const element = getInput(testId);
  element.value = value;
  element.dispatchEvent(new Event("input", { bubbles: true }));
  flushSync();
  await tick();
};
