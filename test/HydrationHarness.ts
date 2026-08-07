import { svelte } from "@sveltejs/vite-plugin-svelte";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import type * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { build } from "vite";
import { afterAll, afterEach, beforeAll } from "vitest";
import type * as HydrationClient from "./HydrationClient.ts";
import type * as HydrationServer from "./HydrationServer.ts";

export interface HydrationProps {
  readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  readonly registry: AtomRegistry.AtomRegistry;
}

export interface SequentialHydrationProps {
  readonly first: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  readonly second: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
  readonly registry: AtomRegistry.AtomRegistry;
}

export interface RenderedApp {
  readonly body: string;
  readonly head: string;
}

interface BuiltHydrationHarness {
  readonly client: typeof HydrationClient;
  readonly outputDirectory: string;
  readonly server: typeof HydrationServer;
}

export interface HydrationHarness {
  readonly client: typeof HydrationClient;
  readonly load: (rendered: RenderedApp) => void;
  readonly server: typeof HydrationServer;
}

const packageRoot = process.cwd();

const makeSveltePlugin = () =>
  svelte({
    compilerOptions: {
      dev: true,
      experimental: { async: true },
    },
  });

const resetDocument = (): void => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  Reflect.deleteProperty(window, "__svelte");
};

const load = (rendered: RenderedApp): void => {
  resetDocument();
  document.body.innerHTML = rendered.body;
  document.head.innerHTML = rendered.head;
  for (const script of document.head.querySelectorAll("script")) {
    // Svelte emits executable hydration data in the rendered head.
    // oxlint-disable-next-line typescript/no-implied-eval typescript/no-unsafe-call
    Function(script.textContent ?? "")();
  }
};

const buildHydrationHarness = async (): Promise<BuiltHydrationHarness> => {
  const outputDirectory = await mkdtemp(resolve(tmpdir(), "atom-svelte-hydration-"));
  const clientDirectory = resolve(outputDirectory, "client");
  const serverDirectory = resolve(outputDirectory, "server");

  try {
    await build({
      configFile: false,
      plugins: [makeSveltePlugin()],
      root: packageRoot,
      build: {
        emptyOutDir: true,
        lib: {
          entry: resolve(packageRoot, "test/HydrationClient.ts"),
          formats: ["iife"],
          fileName: () => "client.js",
          name: "HydrationClient",
        },
        outDir: clientDirectory,
      },
    });
    await build({
      configFile: false,
      plugins: [makeSveltePlugin()],
      root: packageRoot,
      build: {
        emptyOutDir: true,
        outDir: serverDirectory,
        rollupOptions: {
          input: resolve(packageRoot, "test/HydrationServer.ts"),
          output: {
            entryFileNames: "server.cjs",
            format: "cjs",
          },
        },
        ssr: true,
      },
      ssr: { noExternal: true },
    });
    const clientCode = await readFile(resolve(clientDirectory, "client.js"), "utf8");
    // The test must execute the generated browser bundle in the JSDOM realm.
    // oxlint-disable-next-line typescript/no-implied-eval typescript/no-unsafe-call typescript/no-unsafe-type-assertion
    const client = Function(`${clientCode}\nreturn HydrationClient;`)() as typeof HydrationClient;
    const require = createRequire(resolve(packageRoot, "package.json"));
    // The generated server entry has the HydrationServer interface.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const server = require(resolve(serverDirectory, "server.cjs")) as typeof HydrationServer;

    return { client, outputDirectory, server };
  } catch (error) {
    await rm(outputDirectory, { force: true, recursive: true });
    throw error;
  }
};

export const useHydrationHarness = (): HydrationHarness => {
  let built: BuiltHydrationHarness | undefined;

  const getBuilt = (): BuiltHydrationHarness => {
    if (built === undefined) {
      throw new Error("The hydration harness is not ready");
    }
    return built;
  };

  beforeAll(async () => {
    built = await buildHydrationHarness();
  });

  afterEach(resetDocument);

  afterAll(async () => {
    resetDocument();
    if (built !== undefined) {
      await rm(built.outputDirectory, { force: true, recursive: true });
      built = undefined;
    }
  });

  return {
    get client() {
      return getBuilt().client;
    },
    load,
    get server() {
      return getBuilt().server;
    },
  };
};
