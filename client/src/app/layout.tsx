import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://chat-with-pdf-wpyf.onrender.com"),
  title: {
    default: "PDF AI Assistant | Ask Questions from Your PDFs",
    template: "%s | PDF AI Assistant",
  },
  description:
    "Upload a PDF and ask questions about its content using AI. Get fast, relevant answers from your documents without reading every page manually.",
  keywords: [
    "PDF AI assistant",
    "ask questions from PDF",
    "AI PDF chatbot",
    "document Q&A",
    "upload PDF and ask",
    "PDF reader with AI",
    "chat with PDF",
  ],
  applicationName: "PDF AI Assistant",
  authors: [{ name: "PDF AI Assistant" }],
  openGraph: {
    title: "PDF AI Assistant | Ask Questions from Your PDFs",
    description:
      "Upload a PDF and ask questions about its content using AI. Get instant answers grounded in your document.",
    url: "https://chat-with-pdf-wpyf.onrender.com",
    siteName: "PDF AI Assistant",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "PDF AI Assistant",
    description:
      "Upload a PDF and ask questions about its content using AI. Get instant answers from your documents.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
