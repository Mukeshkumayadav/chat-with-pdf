"use client";

import { ChangeEvent, FormEvent, useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0] ?? null;
    setFile(selectedFile);
    if (error) setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!file) {
      setError("Please choose a PDF file first.");
      return;
    }

    if (!question.trim()) {
      setError("Please enter a question about the PDF.");
      return;
    }

    setLoading(true);
    setError("");
    setAnswer("");

    const formData = new FormData();
    formData.append("pdf", file);
    formData.append("question", question.trim());

    try {
      const response = await fetch(`/api/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Something went wrong while processing the PDF.");
      }

      const result = await response.text();
      setAnswer(result || "No answer returned from the server.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to get an answer.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 text-center">
          <p className="mb-2 text-sm font-medium uppercase tracking-[0.25em] text-cyan-400">
            PDF AI Assistant
          </p>
          <h1 className="text-4xl font-bold tracking-tight text-white md:text-5xl">
            Upload a PDF and ask anything
          </h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-300">
                  Select PDF
                </label>
                <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-cyan-500/60 bg-slate-950/60 px-4 py-10 text-center transition hover:border-cyan-400 hover:bg-slate-950">
                  <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                  <span className="text-sm text-slate-200">
                    {file ? file.name : "Choose a PDF file"}
                  </span>
                </label>
              </div>

              <div>
                <label htmlFor="question" className="mb-2 block text-sm font-medium text-slate-300">
                  Your question
                </label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={6}
                  placeholder="Example: What is the main conclusion of this document?"
                  className="w-full resize-none rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-2xl bg-cyan-500 px-4 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Processing PDF..." : "Ask question"}
              </button>
            </form>
          </section>

          <aside className="rounded-3xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/40">
            <h2 className="mb-4 text-xl font-semibold text-white">Answer</h2>
            <div className="min-h-[260px] rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm leading-7 text-slate-200">
              {answer ? (
                <p className="whitespace-pre-wrap">{answer}</p>
              ) : (
                <p className="text-slate-500">
                  Your response will appear here after uploading a PDF and asking a question.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
