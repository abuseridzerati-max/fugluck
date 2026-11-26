import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './public-content.css'

type HelpCenterPageProps = { onNavigate: (path: string) => void; mode?: 'help' | 'faq' }

type HelpSectionId = 's01' | 's02' | 's03' | 's04' | 's05' | 's06' | 's07' | 's08' | 's09'

type HelpSectionContent = {
  code: string
  title: string
  shortTitle: string
  subtitle: string
  summary: string
  intro?: string
  principlesTitle?: string
  principles?: string[]
  journeyTitle?: string
  journey?: string[]
  tableTitle?: string
  tableHeaders?: string[]
  tableRows?: string[][]
  calloutTitle?: string
  calloutBody?: string
  calloutBullets?: string[]
}

type HelpFaqItem = {
  id: string
  section: HelpSectionId
  q: string
  a: string
}

type GlossaryItem = {
  term: string
  definition: string
}

const SECTION_IDS: HelpSectionId[] = ['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08', 's09']

export default function HelpCenterPage({ onNavigate, mode = 'help' }: HelpCenterPageProps) {
  const { t } = useTranslation()
  const isFaq = mode === 'faq'
  const [selectedSection, setSelectedSection] = useState<'all' | HelpSectionId>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const sections = t('helpCenter.sections', { returnObjects: true }) as Record<HelpSectionId, HelpSectionContent>
  const faqs = t('helpCenter.faqs', { returnObjects: true }) as HelpFaqItem[]
  const glossary = t('helpCenter.glossary', { returnObjects: true }) as GlossaryItem[]

  const safeFaqs = Array.isArray(faqs) ? faqs : []
  const safeGlossary = Array.isArray(glossary) ? glossary : []

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return safeFaqs.filter((item) => {
      if (selectedSection !== 'all' && item.section !== selectedSection) return false
      if (!query) return true
      return item.q.toLowerCase().includes(query) || item.a.toLowerCase().includes(query)
    })
  }, [safeFaqs, selectedSection, searchQuery])

  function handleSelectTopic(sectionId: HelpSectionId) {
    setSelectedSection(sectionId)
    const target = document.getElementById(`help-section-${sectionId}`) ?? document.getElementById('faq-list-title')
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
          <a href="/" onClick={(e) => { e.preventDefault(); onNavigate('/') }}>
            {t('helpCenter.breadcrumbHome')}
          </a>
          <span aria-hidden="true">/</span>
          <span aria-current="page">
            {isFaq ? t('helpCenter.breadcrumbFaq') : t('helpCenter.breadcrumbHelp')}
          </span>
        </nav>

        <header className="public-doc__header">
          <div className="public-doc__eyebrow">{t('helpCenter.eyebrow')}</div>
          <h1>{isFaq ? t('helpCenter.faqTitle') : t('helpCenter.title')}</h1>
          <p className="public-doc__subtitle">{t('helpCenter.subtitle')}</p>
        </header>

        {!isFaq && (
          <>
            {/* Topic Index Cards (Sections 01–09) */}
            <section aria-labelledby="help-topics-title" style={{ marginBottom: '2.5rem' }}>
              <h2 id="help-topics-title" className="public-doc__section-heading">
                {t('helpCenter.tocHeading')}
              </h2>
              <div className="help-topics">
                {SECTION_IDS.map((id) => {
                  const sec = sections?.[id]
                  if (!sec) return null
                  return (
                    <article key={id} className="help-topic help-topic--card">
                      <span className="help-topic__code">{sec.code}</span>
                      <h2>{sec.title}</h2>
                      <p>{sec.summary}</p>
                      <button
                        type="button"
                        className="help-topic__link"
                        onClick={() => handleSelectTopic(id)}
                      >
                        {sec.shortTitle} →
                      </button>
                    </article>
                  )
                })}
              </div>
            </section>

            {/* Structured How It Works & Platform Guide (Sections 01–09) */}
            <section aria-labelledby="help-guide-title" style={{ marginBottom: '3rem' }}>
              <h2 id="help-guide-title" className="public-doc__section-heading">
                {t('helpCenter.guideHeading')}
              </h2>

              <div className="help-guide-stack">
                {SECTION_IDS.map((id) => {
                  const sec = sections?.[id]
                  if (!sec) return null
                  const hasGuideBody =
                    Boolean(sec.intro) ||
                    Boolean(sec.principles?.length) ||
                    Boolean(sec.journey?.length) ||
                    Boolean(sec.tableRows?.length) ||
                    Boolean(sec.calloutTitle)

                  if (!hasGuideBody) return null

                  return (
                    <article key={id} id={`help-section-${id}`} className="help-guide-card">
                      <div className="help-guide-card__head">
                        <span className="help-topic__code">{sec.code}</span>
                        <h3>{sec.title}</h3>
                        <p className="help-guide-card__sub">{sec.subtitle}</p>
                      </div>

                      {sec.intro && <p className="help-guide-card__intro">{sec.intro}</p>}

                      {sec.principles && sec.principles.length > 0 && (
                        <div className="help-guide-block">
                          {sec.principlesTitle && <h4>{sec.principlesTitle}</h4>}
                          <ul className="help-guide-list">
                            {sec.principles.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {sec.journey && sec.journey.length > 0 && (
                        <div className="help-guide-block">
                          {sec.journeyTitle && <h4>{sec.journeyTitle}</h4>}
                          <ol className="help-guide-steps">
                            {sec.journey.map((step, idx) => (
                              <li key={idx}>{step}</li>
                            ))}
                          </ol>
                        </div>
                      )}

                      {sec.tableHeaders && sec.tableRows && sec.tableRows.length > 0 && (
                        <div className="help-guide-block">
                          {sec.tableTitle && <h4>{sec.tableTitle}</h4>}
                          <div className="help-table-wrap">
                            <table className="help-table">
                              <thead>
                                <tr>
                                  {sec.tableHeaders.map((head, idx) => (
                                    <th key={idx}>{head}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {sec.tableRows.map((row, rIdx) => (
                                  <tr key={rIdx}>
                                    {row.map((cell, cIdx) => (
                                      <td key={cIdx} className={cIdx === 0 ? 'help-table__lead' : undefined}>
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {sec.calloutTitle && (
                        <aside className="help-callout">
                          <strong>{sec.calloutTitle}</strong>
                          {sec.calloutBody && <p>{sec.calloutBody}</p>}
                          {sec.calloutBullets && sec.calloutBullets.length > 0 && (
                            <ul>
                              {sec.calloutBullets.map((b, idx) => (
                                <li key={idx}>{b}</li>
                              ))}
                            </ul>
                          )}
                        </aside>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          </>
        )}

        {/* 42-Question Master FAQ */}
        <section aria-labelledby="faq-list-title" style={{ marginBottom: '3rem' }}>
          <h2 id="faq-list-title" className="public-doc__section-heading">
            {t('helpCenter.faqHeading')}
          </h2>

          <label className="public-doc__eyebrow" htmlFor="faq-search" style={{ display: 'block', marginBottom: '0.4rem' }}>
            {t('helpCenter.searchLabel')}
          </label>
          <input
            id="faq-search"
            className="help-search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('helpCenter.searchPlaceholder')}
          />

          <div className="faq-controls" role="group" aria-label="FAQ sections">
            <button
              type="button"
              className="faq-control"
              aria-pressed={selectedSection === 'all'}
              onClick={() => setSelectedSection('all')}
            >
              {t('helpCenter.allCategories')} ({safeFaqs.length})
            </button>
            {SECTION_IDS.map((id) => {
              const sec = sections?.[id]
              if (!sec) return null
              return (
                <button
                  key={id}
                  type="button"
                  className="faq-control"
                  aria-pressed={selectedSection === id}
                  onClick={() => setSelectedSection(id)}
                >
                  {sec.shortTitle}
                </button>
              )
            })}
          </div>

          <div aria-live="polite">
            {filteredFaqs.length > 0 ? (
              filteredFaqs.map((item) => (
                <details className="faq-item" key={item.id}>
                  <summary>{item.q}</summary>
                  <div className="faq-item__answer">
                    {item.a.split('\n').map((line, idx) => (
                      <p key={idx}>{line}</p>
                    ))}
                  </div>
                </details>
              ))
            ) : (
              <p role="status" className="ac-text-muted">
                {t('helpCenter.noResults')}
              </p>
            )}
          </div>
        </section>

        {/* Section 10: Player Glossary */}
        {safeGlossary.length > 0 && (
          <section aria-labelledby="glossary-heading" style={{ marginBottom: '2.5rem' }}>
            <h2 id="glossary-heading" className="public-doc__section-heading">
              {t('helpCenter.glossaryHeading')}
            </h2>
            <p className="ac-text-muted" style={{ margin: '0 0 1rem', fontSize: '0.9rem' }}>
              {t('helpCenter.glossarySubtitle')}
            </p>
            <div className="help-table-wrap">
              <table className="help-table">
                <thead>
                  <tr>
                    <th>{t('helpCenter.glossaryTermCol')}</th>
                    <th>{t('helpCenter.glossaryDefCol')}</th>
                  </tr>
                </thead>
                <tbody>
                  {safeGlossary.map((entry, idx) => (
                    <tr key={idx}>
                      <td className="help-table__lead">{entry.term}</td>
                      <td>{entry.definition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="public-doc__related" aria-labelledby="contact-heading">
          <h2 id="contact-heading">{t('helpCenter.stillNeedHelpTitle')}</h2>
          <p>{t('helpCenter.stillNeedHelpBody')}</p>
          <a href="/legal" onClick={(e) => { e.preventDefault(); onNavigate('/legal') }}>
            {t('helpCenter.legalIndexLink')}
          </a>
        </section>
      </main>
      <Footer onNavigate={onNavigate} />
    </div>
  )
}
