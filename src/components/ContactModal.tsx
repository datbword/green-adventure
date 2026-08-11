import { useState } from "react";

export interface ContactInfo {
  customerService: { phone: string; email: string };
  techSupport: { phone: string; email: string };
  address: string;
  timezone: string;
  website: string;
}

interface ContactModalProps {
  open: boolean;
  onClose: () => void;
  brandName: string;
  contact: ContactInfo;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium transition-opacity hover:opacity-75"
      style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)", cursor: "pointer", border: "none" }}
      title={`Copy ${label}`}
    >
      {copied ? "✓" : "📋"}
    </button>
  );
}

export function ContactModal({ open, onClose, brandName, contact }: ContactModalProps) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50"
        style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div
          className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden"
          style={{ backgroundColor: "var(--bg-primary)", border: "1px solid var(--border-color)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor: "var(--border-color)" }}>
            <div>
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{brandName}</h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>Manufacturer Contact</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-lg leading-none transition-colors hover:opacity-70"
              style={{ color: "var(--text-muted)", cursor: "pointer", border: "none", background: "none", minHeight: "44px", minWidth: "44px" }}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4">
            {/* Customer Service */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
                📞 Customer Service
              </h3>
              <div className="space-y-2 text-sm" style={{ color: "var(--text-primary)" }}>
                <div className="flex items-center justify-between">
                  <a href={`tel:${contact.customerService.phone.replace(/[^\d+]/g, '')}`}
                     className="hover:underline font-medium" style={{ color: "var(--accent)" }}>
                    {contact.customerService.phone}
                  </a>
                  <CopyButton text={contact.customerService.phone} label="phone" />
                </div>
                <div className="flex items-center justify-between">
                  <a href={`mailto:${contact.customerService.email}`}
                     className="hover:underline text-sm" style={{ color: "var(--accent)" }}>
                    {contact.customerService.email}
                  </a>
                  <CopyButton text={contact.customerService.email} label="email" />
                </div>
              </div>
            </section>

            {/* Tech Support */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-secondary)" }}>
                🔧 Tech Support
              </h3>
              <div className="space-y-2 text-sm" style={{ color: "var(--text-primary)" }}>
                <div className="flex items-center justify-between">
                  <a href={`tel:${contact.techSupport.phone.replace(/[^\d+]/g, '')}`}
                     className="hover:underline font-medium" style={{ color: "var(--accent)" }}>
                    {contact.techSupport.phone}
                  </a>
                  <CopyButton text={contact.techSupport.phone} label="phone" />
                </div>
                <div className="flex items-center justify-between">
                  <a href={`mailto:${contact.techSupport.email}`}
                     className="hover:underline text-sm" style={{ color: "var(--accent)" }}>
                    {contact.techSupport.email}
                  </a>
                  <CopyButton text={contact.techSupport.email} label="email" />
                </div>
              </div>
            </section>

            {/* Address */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-secondary)" }}>
                📍 Address
              </h3>
              <div className="flex items-center justify-between">
                <p className="text-sm" style={{ color: "var(--text-primary)" }}>{contact.address}</p>
                <CopyButton text={contact.address} label="address" />
              </div>
              <p className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>{contact.timezone}</p>
            </section>

            {/* Website */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-secondary)" }}>
                🌐 Website
              </h3>
              <a
                href={contact.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm hover:underline font-medium"
                style={{ color: "var(--accent)" }}
              >
                {contact.website}
              </a>
            </section>
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t flex justify-end" style={{ borderColor: "var(--border-color)" }}>
            <button
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--accent)",
                color: "#fff",
                cursor: "pointer",
                border: "none",
                minHeight: "44px",
              }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
