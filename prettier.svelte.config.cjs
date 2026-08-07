/** @type {import("prettier").Config} */
module.exports = {
  printWidth: 100,
  singleQuote: false,
  trailingComma: "all",
  singleAttributePerLine: true,
  plugins: ["prettier-plugin-svelte"],
  overrides: [
    {
      files: "*.svelte",
      options: {
        parser: "svelte",
      },
    },
  ],
};
