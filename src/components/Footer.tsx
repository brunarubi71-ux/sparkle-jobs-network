import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="w-full border-t border-border bg-background py-4 px-4 mt-auto">
      <nav className="max-w-2xl mx-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        <Link to="/terms" className="hover:text-primary hover:underline">
          Terms
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/privacy" className="hover:text-primary hover:underline">
          Privacy
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/cancellation" className="hover:text-primary hover:underline">
          Cancellation
        </Link>
      </nav>
    </footer>
  );
}
