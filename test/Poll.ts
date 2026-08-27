import { flushSync, settled, tick } from "svelte";
import { text } from "./TestDom.ts";

/** Repeats a step until the condition holds or the attempt budget ends. */
export const pollUntil = async (
  condition: () => boolean,
  step: () => Promise<void>,
  attempts = 20,
): Promise<void> => {
  for (let attempt = 0; attempt < attempts && !condition(); attempt += 1) {
    await step();
  }
};

/** Flushes Svelte work until one test element renders the expected text. */
export const flushUntilText = async (testId: string, expected: string): Promise<void> => {
  await pollUntil(
    () => text(testId) === expected,
    async () => {
      flushSync();
      await tick();
    },
  );
  if (text(testId) !== expected) {
    throw new Error(`Expected ${testId} to render ${expected}, received ${String(text(testId))}`);
  }
};

/** Flushes Svelte work, waits for async reactions, and yields one macrotask. */
export const flushStep = async (): Promise<void> => {
  flushSync();
  await settled();
  await new Promise((done) => setTimeout(done, 0));
};

/** Waits for one Svelte tick and yields one macrotask. */
export const tickStep = async (): Promise<void> => {
  await tick();
  await new Promise((done) => setTimeout(done, 0));
};
