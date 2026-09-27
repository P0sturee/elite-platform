import { signInWithGoogle } from "@/app/actions/auth";
import { buttonClass } from "./ui";

// Shown only once the Google provider is configured in Supabase (NEXT_PUBLIC_GOOGLE_AUTH=on).
export function GoogleButton({ next }: { next?: string }) {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH !== "on") return null;
  return (
    <>
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next ?? ""} />
        <button className={buttonClass("ghost", "md", "w-full")}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.3 6.6 2.3 12s4.3 9.8 9.7 9.8c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
          </svg>
          Continuar com Google
        </button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-mute">
        <span className="h-px flex-1 bg-line" />ou com e-mail<span className="h-px flex-1 bg-line" />
      </div>
    </>
  );
}
