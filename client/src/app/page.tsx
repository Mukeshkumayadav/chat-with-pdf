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
    <main className="min-h-screen bg-[#020b17] px-4 py-6 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 text-center">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.35em] text-cyan-400">
            PDF AI ASSISTANT
          </p>
          <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">
            Upload a PDF and ask anything
          </h1>
        </header>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="rounded-[28px] border border-slate-700/80 bg-[#071827]/90 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-200">
                  Select PDF
                </label>
                <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-cyan-400/70 bg-[#020f1d] px-4 py-8 text-center transition hover:border-cyan-300 hover:bg-[#041827]">
                  <input type="file" accept="application/pdf" onChange={handleFileChange} className="hidden" />
                  <span className="text-base font-medium text-slate-100">
                    {file ? file.name : "Choose a PDF file"}
                  </span>
                </label>
              </div>

              <div>
                <label htmlFor="question" className="mb-2 block text-sm font-medium text-slate-200">
                  Your question
                </label>
                <textarea
                  id="question"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={7}
                  placeholder="Example: What is the main conclusion of this document?"
                  className="w-full resize-none rounded-2xl border border-slate-700 bg-[#020f1d] px-4 py-3 text-lg text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-400"
                />
              </div>

              {error ? (
                <div className="rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-2xl bg-cyan-400 px-4 py-4 text-xl font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? "Processing PDF..." : "Ask question"}
              </button>
            </form>
          </section>

          <aside className="rounded-[28px] border border-slate-700/80 bg-[#071827]/90 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white">Answer</h2>
            </div>

            <div className="min-h-[560px] rounded-2xl border border-slate-700 bg-[#020f1d] px-5 py-5">
              {answer ? (
                <div className="space-y-4 text-slate-100">
                  <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                    <p className="whitespace-pre-wrap text-[17px] leading-8 text-slate-100">
                      {answer}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full min-h-[500px] items-center justify-center">
                  <p className="max-w-md text-center text-lg leading-8 text-slate-400">
                    Your response will appear here after uploading a PDF and asking a question.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
