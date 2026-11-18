import "../globals.css";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { locales } from "../../lib/schemas";
import ScrollToTop from "../../components/ScrollToTop";
export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!locales.includes(locale as any)) notFound();
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="/fonts/fonts.css" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/icons/favicon-32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="48x48"
          href="/icons/favicon-48.png"
        />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <meta name="theme-color" content="#020001" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Motion Drive" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{document.documentElement.dataset.intro=sessionStorage.getItem('md-intro')?'seen':'new'}catch(e){}",
          }}
        />
      </head>
      <body>
        <NextIntlClientProvider
          locale={locale}
          timeZone="Asia/Tbilisi"
          messages={messages}
        >
          <ScrollToTop />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
