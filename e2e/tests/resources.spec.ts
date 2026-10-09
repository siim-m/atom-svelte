import { expect, type Page, test as base } from "@playwright/test";

const test = base.extend<{ errors: string[] }>({
  // Fails any test whose page throws or logs a console error.
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") {
          errors.push(`console.error: ${message.text()}`);
        }
      });
      await use(errors);
      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

const names = ["a", "b", "c", "d"];
const serverValues = names.map((name) => `${name}:server`);

const readProbe = (page: Page): Promise<E2eProbe> =>
  page.evaluate(() => globalThis.__e2e ?? { evaluations: 0, atomRuns: {} });

const resetProbe = (page: Page): Promise<void> =>
  page.evaluate(() => {
    globalThis.__e2e = { evaluations: 0, atomRuns: {} };
  });

const waitForHydration = (page: Page): Promise<void> =>
  page.locator("html[data-hydrated]").waitFor({ state: "attached" });

/** Waits until the page shows `values` and has settled, so the counters are final. */
const expectSettledValues = async (page: Page, values: readonly string[]): Promise<void> => {
  await expect(page.getByTestId("resources").getByRole("listitem")).toHaveText(values);
  await waitForHydration(page);
  // An extra evaluation re-renders the same values, so no DOM change marks it. It would follow the
  // first evaluation within a few milliseconds.
  await page.waitForTimeout(250);
};

test("hydration renders the server values with one evaluation", async ({ page }) => {
  await page.goto("/");
  await expectSettledValues(page, serverValues);

  expect(await readProbe(page)).toEqual({ evaluations: 1, atomRuns: {} });
});

test("client navigation settles the atoms in the load, then evaluates once", async ({ page }) => {
  await page.goto("/about");
  await waitForHydration(page);

  await page.getByRole("link", { name: "Home" }).click();
  await expectSettledValues(
    page,
    names.map((name) => `${name}:client:1`),
  );

  expect(await readProbe(page)).toEqual({
    evaluations: 1,
    atomRuns: { a: 1, b: 1, c: 1, d: 1 },
  });
});

test("back navigation reads the registry with one evaluation", async ({ page }) => {
  await page.goto("/");
  await expectSettledValues(page, serverValues);

  const rounds: E2eProbe[] = [];
  for (let round = 1; round <= 3; round += 1) {
    await page.getByRole("link", { name: "About" }).click();
    await expect(page.getByRole("heading", { name: "About" })).toBeVisible();
    await resetProbe(page);

    await page.goBack();
    await expectSettledValues(page, serverValues);
    rounds.push(await readProbe(page));
  }

  expect(rounds).toEqual(Array.from({ length: 3 }, () => ({ evaluations: 1, atomRuns: {} })));
});

test("a refresh delivers the new result", async ({ page }) => {
  await page.goto("/");
  await expectSettledValues(page, serverValues);

  await page.getByRole("button", { name: "Refresh a" }).click();
  await expect(page.getByTestId("resources").getByRole("listitem")).toHaveText([
    "a:client:1",
    "b:server",
    "c:server",
    "d:server",
  ]);

  expect((await readProbe(page)).atomRuns).toEqual({ a: 1 });
});
