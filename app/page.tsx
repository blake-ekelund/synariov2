import Link from "next/link";
import { ArrowRight, Briefcase, PiggyBank, LineChart } from "lucide-react";
import ThemeToggle from "../components/theme-toggle";

const cards = [
  {
    title: "Business Synarios",
    description:
      "Model revenue, pricing, hiring, margins, cash runway, and growth assumptions.",
    href: "/business",
    icon: Briefcase,
  },
  {
    title: "Personal Finance Synarios",
    description:
      "Explore retirement, savings, withdrawal strategies, debt payoff, and investing decisions.",
    href: "/personal",
    icon: PiggyBank,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-10 md:px-10">
        {/* Nav */}
        <header className="flex items-center justify-between border-b border-zinc-200 pb-5 dark:border-zinc-800">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
              <LineChart className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">synario.io</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Finance scenarios, minus the spreadsheet swamp
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <nav className="hidden items-center gap-6 text-sm text-zinc-600 dark:text-zinc-300 md:flex">
              <Link href="/business" className="transition hover:text-zinc-900 dark:hover:text-white">
                Business
              </Link>
              <Link href="/personal" className="transition hover:text-zinc-900 dark:hover:text-white">
                Personal
              </Link>
              <Link href="/calculators" className="transition hover:text-zinc-900 dark:hover:text-white">
                Calculators
              </Link>
            </nav>
            <ThemeToggle />
          </div>
        </header>

        {/* Hero */}
        <section className="flex flex-1 items-center py-16 md:py-24">
          <div className="grid w-full gap-12 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div className="space-y-6">
              <div className="inline-flex rounded-full border border-zinc-200 bg-white px-4 py-1.5 text-sm text-zinc-600 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                Build better financial “synarios”
              </div>

              <div className="space-y-4">
                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-950 dark:text-white sm:text-5xl md:text-6xl">
                  See how money decisions play out
                  <span className="block text-zinc-500 dark:text-zinc-400">
                    before real life sends the invoice.
                  </span>
                </h1>

                <p className="max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
                  Synario helps you test business and personal finance scenarios with
                  practical calculators, clear outputs, and less spreadsheet chaos.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/calculators"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                >
                  Explore Calculators
                  <ArrowRight className="h-4 w-4" />
                </Link>

                <Link
                  href="/business"
                  className="inline-flex items-center justify-center rounded-2xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-900 transition hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-900"
                >
                  Start with Business
                </Link>
              </div>

              <div className="grid max-w-2xl grid-cols-1 gap-4 pt-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Business Models
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Revenue, headcount, pricing, margin, runway
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Retirement Tools
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Returns, withdrawals, taxes, contribution paths
                  </p>
                </div>
                <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    Decision Support
                  </p>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    Compare outcomes side by side
                  </p>
                </div>
              </div>
            </div>

            {/* Right side panel */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:p-8">
              <div className="space-y-4">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Start here
                </p>
                <h2 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
                  Choose your lane
                </h2>
                <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400">
                  Pick the type of scenario you want to test. No financial crystal
                  ball nonsense, just structured assumptions and outputs.
                </p>
              </div>

              <div className="mt-6 space-y-4">
                {cards.map((card) => {
                  const Icon = card.icon;

                  return (
                    <Link
                      key={card.title}
                      href={card.href}
                      className="group block rounded-2xl border border-zinc-200 p-5 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                          <Icon className="h-5 w-5" />
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <h3 className="text-base font-semibold text-zinc-950 dark:text-white">
                              {card.title}
                            </h3>
                            <ArrowRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-1 group-hover:text-zinc-700 dark:group-hover:text-zinc-200" />
                          </div>
                          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                            {card.description}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
