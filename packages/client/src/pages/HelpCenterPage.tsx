import { useMemo, useState } from 'react'
import { FAQ_CATEGORIES, FAQ_ITEMS, type FAQItem } from '../legal/faqData'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import './public-content.css'

type HelpCenterPageProps = { onNavigate: (path: string) => void; mode?: 'help' | 'faq' }

const HELP_TOPICS = [
  { title: 'Getting Started', text: 'Learn how to create an account, browse games, understand practice/casual modes and find available competitions.', path: '/how-it-works' },
  { title: 'Account', text: 'Help with sign-in, account access, profile information and account security.', path: '/contact' },
  { title: 'Games', text: 'Game-specific controls, practice mode, supported devices and the difference between practice availability and competition certification.', path: '/games-and-skill' },
  { title: 'Competitions', text: 'How platform-defined competitions work, how to read competition terms, what happens while waiting for another participant and how results are finalized.', path: '/competition-model' },
  { title: 'Entry Fees and Prizes', text: 'Understand the distinction between a published Entry Fee and a Predetermined Prize, including standard, promotional and freeroll formats.', path: '/entry-fees-prizes' },
  { title: 'Coins', text: 'Explanation of Fugluck’s free, non-monetary virtual points.', path: '/coins' },
  { title: 'TEST / Sandbox GEL', text: 'Explanation of simulated TEST value, how it is added for demonstrations and why it cannot be deposited, withdrawn or redeemed.', path: '/test-gel' },
  { title: 'Technical Issues', text: 'Troubleshooting for browser compatibility, connectivity, latency admission, frozen screens and error messages.', path: '/fair-play' },
  { title: 'Disconnects and Voided Matches', text: 'What reconnect means, what a void means and how the platform handles failures without inventing an unjustified winner.', path: '/rules' },
  { title: 'Fair Play', text: 'Rules against cheating, automation, tampering, account misuse and other conduct that undermines competition integrity.', path: '/fair-play' },
  { title: 'Privacy', text: 'How to find Fugluck’s Privacy Policy and how to contact the operator about privacy questions once verified contact details are published.', path: '/privacy' },
  { title: 'Contact Support', text: 'How to contact the operator for account, technical, competition or fair-play questions. Verified support details are still required.', path: '/contact' },
]

export default function HelpCenterPage({ onNavigate, mode = 'help' }: HelpCenterPageProps) {
  const isFaq = mode === 'faq'
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return FAQ_ITEMS.filter((item) => {
      if (selectedCategory !== 'all' && item.categoryId !== selectedCategory) return false
      return !query || item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query) || item.tags.some((tag) => tag.toLowerCase().includes(query))
    })
  }, [selectedCategory, searchQuery])

  return <div className="public-page">
    <Navbar onNavigateHome={() => onNavigate('/')} onNavigateFriends={() => onNavigate('/friends')} onNavigateProfile={() => onNavigate('/profile')} onNavigateWallet={() => onNavigate('/wallet')} />
    <main className="public-page__main">
      <nav className="public-breadcrumb" aria-label="Breadcrumb"><a href="/" onClick={(e) => { e.preventDefault(); onNavigate('/') }}>Home</a><span aria-hidden="true">/</span><span aria-current="page">{isFaq ? 'FAQ' : 'Help Center'}</span></nav>
      <header className="public-doc__header">
        <div className="public-doc__eyebrow">Fugluck support information</div>
        <h1>{isFaq ? 'Frequently Asked Questions' : 'Help Center'}</h1>
        <p className="public-doc__subtitle">{isFaq ? 'Answers about game modes, competition terms, results and simulated balances.' : 'Guides for accounts, games, competitions, TEST GEL and technical issues.'}</p>
      </header>

      {!isFaq && <section aria-labelledby="help-topics-title">
        <h2 id="help-topics-title" className="public-doc__section-heading">Browse help topics</h2>
        <div className="help-topics">{HELP_TOPICS.map((topic) => <article key={topic.title} className="help-topic">
          <h2>{topic.title}</h2><p>{topic.text}</p><a href={topic.path} onClick={(e) => { e.preventDefault(); onNavigate(topic.path) }}>Read this guide</a>
        </article>)}</div>
      </section>}

      <section aria-labelledby="faq-list-title">
        {!isFaq && <h2 id="faq-list-title" className="public-doc__section-heading">Common questions</h2>}
        {isFaq && <h2 id="faq-list-title" className="public-doc__section-heading">Search and browse answers</h2>}
        <label className="public-doc__eyebrow" htmlFor="faq-search">Search questions</label><br />
        <input id="faq-search" className="help-search" type="search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search questions and answers" />
        <div className="faq-controls" aria-label="FAQ categories">
          <button type="button" className="faq-control" aria-pressed={selectedCategory === 'all'} onClick={() => setSelectedCategory('all')}>All questions ({FAQ_ITEMS.length})</button>
          {FAQ_CATEGORIES.map((category) => <button key={category.id} type="button" className="faq-control" aria-pressed={selectedCategory === category.id} onClick={() => setSelectedCategory(category.id)}>{category.title}</button>)}
        </div>
        <div aria-live="polite">
          {filteredItems.length ? filteredItems.map((item: FAQItem) => <details className="faq-item" key={item.id}>
            <summary>{item.question}</summary>
            <div className="faq-item__answer"><p>{item.answer}</p>{item.relatedPolicySlug && <a href={`/${item.relatedPolicySlug}`} onClick={(e) => { e.preventDefault(); onNavigate(`/${item.relatedPolicySlug}`) }}>Read more: {item.relatedPolicyLabel || 'Related information'}</a>}</div>
          </details>) : <p role="status">No answers match this search. Try another term or category.</p>}
        </div>
      </section>

      <section className="public-doc__related" aria-labelledby="contact-heading">
        <h2 id="contact-heading">Still need help?</h2>
        <p>Contact and support details are pending verified operator input. See the Contact / Who We Are page for the fields that still need confirmation.</p>
        <a href="/contact" onClick={(e) => { e.preventDefault(); onNavigate('/contact') }}>Contact / Who We Are</a>
      </section>
    </main>
    <Footer onNavigate={onNavigate} />
  </div>
}
