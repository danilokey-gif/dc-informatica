import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

// O eslint-config-next 15 ainda é publicado no formato antigo (.eslintrc); o FlatCompat converte
// para o formato "flat" do ESLint 9.
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const eslintConfig = [
  { ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "scripts/**", "public/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // "any" em catch (e: any) é código antigo que funciona: fica como aviso, não como erro.
      "@typescript-eslint/no-explicit-any": "warn",
      // Parâmetro que começa com _ é ignorado de propósito (ex.: estado anterior do useActionState).
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

export default eslintConfig;
