import { useTranslation } from 'react-i18next'
import { POLICY_NAV_ITEMS } from '@fugluck/shared'

type FooterProps = { onNavigate: (path: string) => void }

export default function Footer({ onNavigate }: FooterProps) {
  const { t } = useTranslation()
  const columns = [
    { id: 'FUGLUCK', heading: t('policies.footer.productHeading', 'Fugluck'), items: POLICY_NAV_ITEMS.filter((item) => item.category === 'FUGLUCK') },
    { id: 'HELP', heading: t('policies.footer.helpHeading', 'Help'), items: POLICY_NAV_ITEMS.filter((item) => item.category === 'HELP') },
    { id: 'LEGAL', heading: t('policies.footer.legalHeading', 'Legal'), items: POLICY_NAV_ITEMS.filter((item) => item.category === 'LEGAL') },
  ]

  function handleLinkClick(e: React.MouseEvent<HTMLAnchorElement>, path: string) {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    onNavigate(path)
  }

  return (
    <footer className="site-footer">
      <div className="site-footer__columns">
        <div className="site-footer__brand">
          <a className="site-footer__logo" href="/" onClick={(e) => handleLinkClick(e, '/')}>Fugluck</a>
          <p>Competitive skill games, practice and platform-defined competitions.</p>
        </div>
        {columns.map((column) => <nav key={column.id} aria-label={column.heading}>
          <h2>{column.heading}</h2>
          <ul>{column.items.map((item) => <li key={item.path}>
            <a href={item.path} onClick={(e) => handleLinkClick(e, item.path)}>{t(item.titleKey)}</a>
          </li>)}</ul>
        </nav>)}
      </div>
      <div className="site-footer__bottom">
        <p>TEST / SANDBOX ENVIRONMENT — NO REAL MONEY. GEL-denominated values shown here are simulated and have zero real-world value. They cannot be deposited, withdrawn or redeemed. No real payment rails or real-money prizes are active.</p>
        <a href="/legal" onClick={(e) => handleLinkClick(e, '/legal')}>{t('policies.nav.legalIndex', 'Legal and Policy Index')}</a>
      </div>
    </footer>
  )
}
