import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/build/**', 'apps/desktop/**'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    settings: {
      // Pinned rather than 'detect'. Detection shells out to the plugin's
      // resolveBasedir(), which calls an ESLint context API that was removed
      // in ESLint 10 — eslint-plugin-react 7.37.5 still declares a peer range
      // ending at ^9.7 — and the whole lint run dies with
      // "contextOrFilename.getFilename is not a function". Naming the version
      // skips detection entirely. Keep in sync with react in apps/web/package.json.
      react: { version: '18.3' },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',

      // Warn, not error. This rule (new in eslint-plugin-react-hooks 7) is
      // aimed at setState called *synchronously* in an effect body, which
      // cascades renders. Every occurrence here is the opposite: an async
      // useCallback that awaits IndexedDB and then sets the result
      // (`useEffect(() => { reload() }, [reload])`), which is how all 17 data
      // loads in this app are written. Kept visible rather than silenced, but
      // it shouldn't fail the build — converting them is a deliberate
      // refactor, not a lint cleanup.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  prettierConfig,
);
