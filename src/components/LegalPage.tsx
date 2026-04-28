import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import Footer from "@/components/Footer";

interface LegalPageProps {
  title: string;
  markdown: string;
}

export default function LegalPage({ title, markdown }: LegalPageProps) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header
        className="relative px-4 pt-6 pb-8 text-white"
        style={{
          background:
            "linear-gradient(145deg, #4C1D95 0%, #7C3AED 35%, #A855F7 60%, #9333EA 80%, #6D28D9 100%)",
        }}
      >
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          className="inline-flex items-center gap-1 text-sm text-white/90 hover:text-white"
          aria-label="Back"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <h1 className="mt-3 text-2xl font-bold">{title}</h1>
      </header>

      <main className="flex-1 px-4 py-6 max-w-2xl w-full mx-auto">
        <article className="prose prose-sm sm:prose-base max-w-none prose-headings:text-foreground prose-p:text-foreground/80 prose-a:text-primary prose-strong:text-foreground">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </article>
      </main>

      <Footer />
    </div>
  );
}
