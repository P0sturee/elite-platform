"use client";

import { useFormStatus } from "react-dom";
import { useState, type ComponentProps } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { buttonClass } from "./ui";

export function SubmitButton({
  children, pendingText, variant, size, className, ...props
}: ComponentProps<"button"> & { pendingText?: string; variant?: Parameters<typeof buttonClass>[0]; size?: Parameters<typeof buttonClass>[1] }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || props.disabled} className={buttonClass(variant, size, className)} {...props}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {pending ? pendingText ?? children : children}
    </button>
  );
}

export function CopyButton({ text, label = "Copiar", doneLabel = "Copiado" }: { text: string; label?: string; doneLabel?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("ghost", "sm")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 2000);
        } catch {
          window.prompt("Copie o texto:", text);
        }
      }}
    >
      {done ? <Check className="size-4 text-green" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {done ? doneLabel : label}
    </button>
  );
}
