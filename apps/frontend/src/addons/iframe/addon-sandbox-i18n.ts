import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LOCALE, SUPPORTED_LOCALE_CODES, type LocaleCode } from "@/i18n/locales";
import deUi from "@/i18n/locales/de/ui.json";
import enUi from "@/i18n/locales/en/ui.json";
import esUi from "@/i18n/locales/es/ui.json";
import frUi from "@/i18n/locales/fr/ui.json";
import jaUi from "@/i18n/locales/ja/ui.json";
import koUi from "@/i18n/locales/ko/ui.json";
import zhUi from "@/i18n/locales/zh/ui.json";

// The sandbox iframe renders `@wealthfolio/ui` components that call
// `useTranslation()` against `ui:`-namespaced keys. The iframe is its own realm,
// so it does not inherit the host's i18next instance — without one, those
// components log `NO_I18NEXT_INSTANCE` and render raw keys ("ui:sheet.close").
//
// Only the `ui` namespace is bundled, and statically rather than through the
// host's lazy `resourcesToBackend`: the sandbox runs under a strict CSP and
// fetching locale chunks at runtime is not worth the failure mode when the
// whole namespace is a few KB per language.
//
// Typed as Record<LocaleCode, …> on purpose — adding a locale to
// SUPPORTED_LOCALES without adding it here is a type error, not a silent
// fallback to English.
const resources: Record<LocaleCode, { ui: Record<string, unknown> }> = {
  de: { ui: deUi },
  en: { ui: enUi },
  es: { ui: esUi },
  fr: { ui: frUi },
  ja: { ui: jaUi },
  ko: { ui: koUi },
  zh: { ui: zhUi },
};

// Map regional codes (e.g. `fr-CA`) to the base language, matching the host.
function normalizeLanguage(language: string) {
  return language.split("-")[0];
}

function applyDocumentLanguage(language: string) {
  // Han unification: ja/ko/zh share codepoints that render with different
  // preferred glyphs, so the iframe document needs its own lang attribute.
  document.documentElement.setAttribute("lang", language);
}

// A dedicated instance rather than the shared i18next default: the sandbox owns
// its own translations, and this way initialization order can never leave it
// silently piggybacking on someone else's config.
const sandboxI18n = i18next.createInstance();

export function initSandboxI18n(language?: string) {
  if (sandboxI18n.isInitialized) {
    setSandboxLanguage(language);
    return sandboxI18n;
  }

  const initialLanguage = language ? normalizeLanguage(language) : DEFAULT_LOCALE;

  // `initReactI18next` also registers this instance as react-i18next's default,
  // so `@wealthfolio/ui` components resolve it without an I18nextProvider.
  void sandboxI18n.use(initReactI18next).init({
    lng: initialLanguage,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALE_CODES,
    load: "languageOnly",
    ns: ["ui"],
    defaultNS: "ui",
    resources,
    interpolation: {
      // React already escapes values.
      escapeValue: false,
    },
    react: {
      // Resources are bundled synchronously, so there is nothing to suspend on
      // — and suspending here would land outside the route Suspense boundary.
      useSuspense: false,
    },
  });

  applyDocumentLanguage(initialLanguage);
  return sandboxI18n;
}

export function setSandboxLanguage(language?: string) {
  if (!language) {
    return;
  }

  const normalized = normalizeLanguage(language);
  if (sandboxI18n.language === normalized) {
    return;
  }

  void sandboxI18n.changeLanguage(normalized);
  applyDocumentLanguage(normalized);
}
