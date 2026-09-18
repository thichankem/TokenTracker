import React from "react";
import { Check, Copy, Globe, ScanLine } from "lucide-react";
import { copy } from "../../lib/copy";
import { QrCode } from "../../ui/dashboard/components/QrCode";
import {
  DEFAULT_PHONE_URL,
  getPhoneAccessDomain,
  normalizePhoneAccessDomain,
  setPhoneAccessDomain,
} from "../../lib/phone-access";
import { SectionCard } from "./Controls.jsx";

/**
 * "Remote Connection" settings section. Shows a QR code immediately — scan it
 * with a phone camera to open the dashboard on the phone. Supports a custom
 * domain so the QR can point at the user's own domain instead of the default.
 */
export function RemoteConnectionSection() {
  const [domainInput, setDomainInput] = React.useState(() => getPhoneAccessDomain());
  const [copied, setCopied] = React.useState(false);

  const normalized = normalizePhoneAccessDomain(domainInput);
  const qrUrl = normalized || DEFAULT_PHONE_URL;
  const usingCustom = Boolean(normalized);

  const handleDomainChange = (e) => {
    const value = e.target.value;
    setDomainInput(value);
    setPhoneAccessDomain(value);
  };

  const handleCopy = async () => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) return;
      await navigator.clipboard.writeText(qrUrl);
      setCopied(true);
      globalThis.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <SectionCard title={copy("settings.section.remote")} subtitle={copy("settings.section.remote.description")}>
      <div className="py-2">
        <div className="flex justify-center">
          <div className="rounded-xl bg-white p-4 ring-1 ring-oai-gray-200 dark:ring-oai-gray-800">
            <QrCode value={qrUrl} size={220} ariaLabel={copy("settings.remote.qrLabel")} />
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 rounded-lg bg-oai-gray-100 px-3 py-2 dark:bg-oai-gray-900">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-oai-gray-600 dark:text-oai-gray-300">
            {qrUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-oai-gray-200 px-2.5 text-xs font-medium text-oai-gray-700 transition-colors hover:bg-white dark:border-oai-gray-700 dark:text-oai-gray-300 dark:hover:bg-oai-gray-800"
            aria-label={copy("settings.remote.copyUrl")}
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            {copied ? copy("settings.remote.copied") : copy("settings.remote.copyUrl")}
          </button>
        </div>

        <label className="mt-5 block">
          <span className="flex items-center gap-1.5 text-xs font-medium text-oai-gray-700 dark:text-oai-gray-300">
            <Globe className="h-3.5 w-3.5" aria-hidden />
            {copy("settings.remote.domainLabel")}
          </span>
          <input
            type="text"
            value={domainInput}
            onChange={handleDomainChange}
            placeholder={copy("settings.remote.domainPlaceholder")}
            spellCheck={false}
            autoComplete="off"
            className="mt-1.5 w-full rounded-lg border border-oai-gray-200 bg-white px-3 py-2 font-mono text-sm text-oai-gray-900 outline-none transition-colors placeholder:text-oai-gray-400 focus:border-oai-gray-400 focus:ring-2 focus:ring-oai-gray-200 dark:border-oai-gray-800 dark:bg-oai-gray-900 dark:text-oai-gray-100 dark:placeholder:text-oai-gray-500 dark:focus:border-oai-gray-600 dark:focus:ring-oai-gray-800"
          />
        </label>
        <p className="mt-1.5 text-xs leading-5 text-oai-gray-500 dark:text-oai-gray-400">
          {usingCustom ? copy("settings.remote.domainNote") : copy("settings.remote.domainHint")}
        </p>

        <div className="mt-5 flex items-start gap-2 rounded-lg bg-oai-gray-50 px-3 py-2.5 dark:bg-oai-gray-900/60">
          <ScanLine className="mt-0.5 h-4 w-4 shrink-0 text-oai-gray-400 dark:text-oai-gray-500" aria-hidden />
          <ol className="list-decimal space-y-1 pl-4 text-xs leading-5 text-oai-gray-600 dark:text-oai-gray-300">
            <li>{copy("settings.remote.step1")}</li>
            <li>{copy("settings.remote.step2")}</li>
            <li>{copy("settings.remote.step3")}</li>
          </ol>
        </div>

        <p className="mt-4 text-xs leading-5 text-oai-gray-500 dark:text-oai-gray-400">
          {copy("settings.remote.cloudSyncHint")}
        </p>
      </div>
    </SectionCard>
  );
}