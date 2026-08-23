'use client';

import Link from '@/components/LocaleLink';
import { useT } from '@/components/I18nProvider';
import Logo from '@/components/Logo';

type FooterColumn = [titleKey: string, links: [href: string, labelKey: string][]];

const COLS: FooterColumn[] = [
  ['footer.play', [
    ['/library', 'footer.allGames'],
    ['/', 'footer.featured'],
    ['/play/block-fall', 'footer.quickPlay']
  ]],
  ['footer.account', [
    ['/profile', 'footer.profile'],
    ['/profile#trophies', 'footer.trophies'],
    ['/settings', 'footer.settings']
  ]],
  ['footer.support', [
    ['/help', 'footer.help'],
    ['/controller-setup', 'footer.controllerSetup'],
    ['/status', 'footer.status']
  ]]
];

export default function Footer() {
  const t = useT();

  return (
    <footer className="bg-black text-white mt-24">
      <div className="container py-16">
        <div className="grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo size={34} wordSize={24} />
            <p className="mt-3 max-w-[34ch]" style={{ color: 'rgba(255,255,255,.62)', fontWeight: 330, lineHeight: 1.5 }}>
              {t('footer.blurb')}
            </p>
            <div className="mt-6 flex gap-2">
              <Link className="btn btn-glass btn-sm" href="/library">{t('footer.browse')}</Link>
              <Link className="btn btn-white btn-sm" href="/play/neon-runner">{t('footer.playNow')}</Link>
            </div>
          </div>
          {COLS.map(([title, links]) => (
            <div key={title}>
              <p className="mono" style={{ color: 'rgba(255,255,255,.5)' }}>{t(title)}</p>
              <ul className="mt-4 space-y-2.5 list-none p-0 m-0">
                {links.map(([href, label]) => (
                  <li key={href}>
                    <Link className="no-underline hover:underline" style={{ color: 'rgba(255,255,255,.82)', fontSize: 15, fontWeight: 330 }} href={href}>{t(label)}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 pt-6 flex flex-col sm:flex-row gap-3 justify-between" style={{ borderTop: '1px solid rgba(255,255,255,.14)' }}>
          <p className="mono" style={{ color: 'rgba(255,255,255,.45)' }}>{t('footer.copyright')}</p>
          <p className="mono" style={{ color: 'rgba(255,255,255,.45)' }}>{t('footer.disclaimer')}</p>
        </div>
      </div>
    </footer>
  );
}
