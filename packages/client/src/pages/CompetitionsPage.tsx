import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CompetitionTemplate } from '@fugluck/shared'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import CompetitionCatalog from '../components/CompetitionCatalog'
import MyCompetitions from '../components/MyCompetitions'
import { useAuth } from '../auth/AuthContext'
import { apiFetch } from '../lib/api'
import '../components/competition.css'

export default function CompetitionsPage({onNavigateHome,onNavigateProfile,onNavigateFriends,onNavigateWallet,onLaunchCompetition,onNavigatePolicy}:{
  onNavigateHome:()=>void;onNavigateProfile:()=>void;onNavigateFriends:()=>void;onNavigateWallet:()=>void;
  onLaunchCompetition:(gameId:string,template:CompetitionTemplate)=>void;onNavigatePolicy?:(path:string)=>void
}) {
  const {t,i18n}=useTranslation();const {user,refreshUser}=useAuth();const [game,setGame]=useState('all');const [funding,setFunding]=useState(false);const [fundingError,setFundingError]=useState(false)
  async function addTestFunds(){setFunding(true);setFundingError(false);try{await apiFetch('/api/competitions/sandbox-faucet',{method:'POST',body:JSON.stringify({amountMinor:10000})});await refreshUser()}catch{setFundingError(true)}finally{setFunding(false)}}
  return <div className="competition-ux" lang={i18n.resolvedLanguage} style={{minHeight:'100vh',display:'flex',flexDirection:'column'}}>
    <Navbar onNavigateHome={onNavigateHome} onNavigateProfile={onNavigateProfile} onNavigateFriends={onNavigateFriends} onNavigateWallet={onNavigateWallet} onNavigateCompetitions={()=>setGame('all')}/>
    <main className="competition-page" style={{flex:1}}><header className="competition-heading"><div><h1>{t('competition.title')}</h1><p>{t('competition.tagline')}</p></div></header>
      <aside className="competition-notice"><div><strong>{t('competition.testLabel')}</strong><p>{t('competition.testNotice')}</p></div>{user&&<button type="button" className="ac-btn ac-btn--secondary" disabled={funding} onClick={addTestFunds}>{t(funding?'competition.addingTestFunds':'competition.addTestFunds')}</button>}</aside>
      {fundingError&&<p role="alert">{t('competition.fundsError')}</p>}
      <div className="competition-filters" role="group" aria-label={t('competition.filterGames')}>{['all','space-blaster','cyber-hopper'].map(id=><button key={id} type="button" aria-pressed={game===id} className={`ac-pill${game===id?' ac-pill--active':''}`} onClick={()=>setGame(id)}>{id==='all'?t('competition.all'):id==='space-blaster'?'Space Blaster':'Cyber Hopper'}</button>)}</div>
      <CompetitionCatalog gameId={game==='all'?undefined:game} onShowAll={()=>setGame('all')} onJoinCompetition={template=>onLaunchCompetition(template.gameId,template)}/>
      <MyCompetitions onLaunch={template=>onLaunchCompetition(template.gameId,template)}/>
    </main><Footer onNavigate={onNavigatePolicy??onNavigateHome}/>
  </div>
}
