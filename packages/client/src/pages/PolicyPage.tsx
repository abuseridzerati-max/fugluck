import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { POLICIES, type PolicyDocument } from '../legal/policyData'
import { POLICIES_KA } from '../legal/policyData.ka'
import { POLICIES_RU } from '../legal/policyData.ru'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './public-content.css'

type PolicyPageProps = { policySlug: string; onNavigate: (path: string) => void }

function ContentBlocks({ lines }: { lines: string[] }) {
  const output: Array<{ kind: 'paragraph'; text: string } | { kind: 'list'; items: string[] } | { kind: 'steps'; items: string[] }> = []
  for (const line of lines) {
    if (line.startsWith('• ')) {
      const last = output[output.length - 1]
      if (last?.kind === 'list') last.items.push(line.slice(2))
      else output.push({ kind: 'list', items: [line.slice(2)] })
    } else if (/^\d+\. /.test(line)) {
      const last = output[output.length - 1]
      if (last?.kind === 'steps') last.items.push(line.replace(/^\d+\. /, ''))
      else output.push({ kind: 'steps', items: [line.replace(/^\d+\. /, '')] })
    } else {
      output.push({ kind: 'paragraph', text: line })
    }
  }
  return <>{output.map((block, index) => {
    if (block.kind === 'list') return <ul key={index} className="public-doc__list">{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
    if (block.kind === 'steps') return <ol key={index} className="public-doc__list">{block.items.map((item, i) => <li key={i}>{item}</li>)}</ol>
    return <p key={index}>{block.text}</p>
  })}</>
}

export default function PolicyPage({ policySlug, onNavigate }: PolicyPageProps) {
  const { t, i18n } = useTranslation()
  const lang = (i18n.resolvedLanguage || i18n.language || 'en').slice(0, 2)
  const activePolicies = lang === 'ka' ? POLICIES_KA : lang === 'ru' ? POLICIES_RU : POLICIES
  const doc: PolicyDocument | undefined = activePolicies[policySlug] ?? POLICIES[policySlug]

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [policySlug])

  if (!doc) {
    return (
      <div className="public-page">
        <Navbar
          onNavigateHome={() => onNavigate('/')}
          onNavigateFriends={() => onNavigate('/friends')}
          onNavigateProfile={() => onNavigate('/profile')}
          onNavigateWallet={() => onNavigate('/wallet')}
          onNavigateCompetitions={() => onNavigate('/competitions')}
        />
        <main className="public-page__main">
          <h1>{t('policyPage.notFoundTitle')}</h1>
          <p>{t('policyPage.notFoundBody')}</p>
          <button className="ac-btn ac-btn--primary" onClick={() => onNavigate('/help')}>
            {t('policyPage.visitHelp')}
          </button>
        </main>
        <Footer onNavigate={onNavigate} />
      </div>
    )
  }

  const extraRelatedLinks: Record<string, { slug: string; title: string }> = {
    competitions: { slug: 'competitions', title: t('policyPage.extraCompetitions') },
    wallet: { slug: 'wallet', title: t('policyPage.extraWallet') },
    help: { slug: 'help', title: t('policyPage.extraHelp') },
  }

  const relatedDocs = doc.relatedSlugs
    .map((slug) => activePolicies[slug] ?? POLICIES[slug] ?? extraRelatedLinks[slug])
    .filter(Boolean) as Array<{ slug: string; title: string }>
  const isLegalDraft = doc.status === 'DRAFT_LEGAL_REVIEW' || doc.status === 'DRAFT_IMPLEMENTATION_REVIEW' || doc.status === 'PRODUCT_ALIGNED_DRAFT'

  return (
    <div className="public-page">
      <Navbar
        onNavigateHome={() => onNavigate('/')}
        onNavigateFriends={() => onNavigate('/friends')}
        onNavigateProfile={() => onNavigate('/profile')}
        onNavigateWallet={() => onNavigate('/wallet')}
        onNavigateCompetitions={() => onNavigate('/competitions')}
      />
      <main className="public-page__main">
        <nav className="public-breadcrumb" aria-label="Breadcrumb">
          <a href="/" onClick={(e) => { e.preventDefault(); onNavigate('/') }}>{t('policyPage.home')}</a><span aria-hidden="true">/</span>
          <a href="/legal" onClick={(e) => { e.preventDefault(); onNavigate('/legal') }}>{t('policyPage.publicPolicies')}</a><span aria-hidden="true">/</span>
          <span aria-current="page">{doc.title}</span>
        </nav>

        <header className="public-doc__header">
          <div className="public-doc__eyebrow">{doc.statusText}</div>
          <h1>{doc.title}</h1>
          <p className="public-doc__subtitle">{doc.subtitle}</p>
          {doc.version && <div className="public-doc__metadata">{t('policyPage.draftVersion', { version: doc.version })}</div>}
          {isLegalDraft && <p className="public-doc__review-note">{t('policyPage.draftNote')}</p>}
        </header>

        <div className="public-doc__layout">
          <article className="public-doc__body">
            <p className="public-doc__summary">{doc.summary}</p>
            {doc.sections.map((item) => (
              <section className="public-doc__section" key={item.id} id={item.id}>
                <h2>{item.heading}</h2>
                <ContentBlocks lines={item.content} />
                {item.note && <p className="public-doc__note">{item.note}</p>}
              </section>
            ))}
            {relatedDocs.length > 0 && (
              <nav className="public-doc__related" aria-label={t('policyPage.relatedInfo')}>
                <h2>{t('policyPage.relatedInfo')}</h2>
                <ul>
                  {relatedDocs.map((related) => (
                    <li key={related.slug}>
                      <a href={`/${related.slug}`} onClick={(e) => { e.preventDefault(); onNavigate(`/${related.slug}`) }}>
                        {related.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
          </article>
          <aside className="public-doc__toc">
            <details open>
              <summary>{t('policyPage.onThisPage')}</summary>
              <nav aria-label={t('policyPage.onThisPage')}>
                {doc.sections.map((item) => <a key={item.id} href={`#${item.id}`}>{item.heading}</a>)}
              </nav>
            </details>
          </aside>
        </div>
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  )
}
