import '../globals.css';
import type { Metadata } from 'next';
import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import { I18nProvider } from '@/components/I18nProvider';
import { getUserDto } from '@/lib/auth';
import { LOCALES, getDictionary, type Locale } from './dictionaries';

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const dict = await getDictionary();
  return { title: dict.meta.title, description: dict.meta.description };
}

export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  const [dict, user] = await Promise.all([getDictionary(), getUserDto()]);

  return (
    // Browser extensions like to stamp their own attributes onto <html> before
    // React hydrates, which reads as a mismatch and throws the whole tree away.
    // Suppression is one level deep: the attributes on this element are
    // forgiven, everything inside is still checked.
    <html lang={lang} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- App Router root layout, not pages/_document */}
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* The dictionary is read once, on the server, and handed to the client
            tree — `next/root-params` deliberately does not reach Client
            Components, and most of this app is one. */}
        <I18nProvider locale={lang as Locale} dict={dict}>
          <Nav user={user} />
          {children}
          <Footer />
        </I18nProvider>
      </body>
    </html>
  );
}
