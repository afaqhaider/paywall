import rootConfig from "../../eslint.config.mjs";

export default [
  ...rootConfig,
  {
    // NestJS relies on emitDecoratorMetadata for constructor-based dependency
    // injection: converting a constructor-injected class import to `import type`
    // erases the runtime reference Nest needs to resolve the provider.
    rules: {
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },
];
