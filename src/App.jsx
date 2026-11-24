import { lazy, Suspense } from 'react'
import { BrowserRouter, Link, Navigate, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import ErrorBoundary from './components/ErrorBoundary'
import LocationPrompt from './components/LocationPrompt'
import Home from './pages/Home'
import Results from './pages/Results'
import RestaurantDetail from './pages/RestaurantDetail'
import { LocationProvider } from './context/LocationContext'
import { AuthProvider } from './context/AuthContext'
import { CatalogProvider } from './context/CatalogContext'
import DataSources from './components/DataSources'
import { pixabayLibraryReady } from './data/pixabayLibrary'
import RecoveryRedirect from './components/RecoveryRedirect'
import PageMeta from './components/PageMeta'
import CompareBar from './components/CompareBar'
import { CompareProvider } from './context/CompareContext'
import { CONTACT_EMAIL } from './constants/brand'

const Support = lazy(() => import('./pages/ForBusiness'))
const ForBusinesses = lazy(() => import('./pages/ForBusinesses'))
const BusinessAccount = lazy(() => import('./pages/BusinessAccount'))
const AdminApplications = lazy(() => import('./pages/AdminApplications'))
const AdminPromotions = lazy(() => import('./pages/AdminPromotions'))
const AdminPlaces = lazy(() => import('./pages/AdminPlaces'))
const AdminReports = lazy(() => import('./pages/AdminReports'))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const NewPassword = lazy(() => import('./pages/NewPassword'))
const DealDetail = lazy(() => import('./pages/DealDetail'))
const Favorites = lazy(() => import('./pages/Favorites'))
const Rewards = lazy(() => import('./pages/Rewards'))
const AdminLoyalty = lazy(() => import('./pages/AdminLoyalty'))
const Privacy = lazy(() => import('./pages/Privacy'))
const Terms = lazy(() => import('./pages/Terms'))
const SiteInfo = lazy(() => import('./pages/SiteInfo'))
const Compare = lazy(() => import('./pages/Compare'))
const SurpriseMe = lazy(() => import('./pages/SurpriseMe'))

function RouteFallback() {
  return (
    <main className="page">
      <p className="section-desc">Načítám…</p>
    </main>
  )
}

function NotFound() {
  return (
    <main className="page">
      <h1 className="section-title">Stránka nenalezena</h1>
      <p className="section-desc">Tahle adresa v FoodGo není.</p>
      <Link to="/" className="btn btn-primary">
        Zpět na úvod
      </Link>
    </main>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <CatalogProvider>
      <LocationProvider>
      <CompareProvider>
        <div className="app">
          <a className="skip-link" href="#main-content">
            Přeskočit na obsah
          </a>
          <RecoveryRedirect />
          <PageMeta />
          <Header />
          <LocationPrompt />
          <CompareBar />
          <div id="main-content" tabIndex={-1}>
          <ErrorBoundary>
          <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results" element={<Results />} />
            <Route path="/restaurant/:id" element={<RestaurantDetail />} />
            <Route path="/oblibene" element={<Favorites />} />
            <Route path="/nevim-co-jist" element={<SurpriseMe />} />
            <Route path="/porovnani" element={<Compare />} />
            <Route path="/results/mapa" element={<Navigate to="/results?view=map" replace />} />
            <Route path="/odmeny" element={<Rewards />} />
            <Route path="/nabidka/:dealId" element={<DealDetail />} />
            <Route path="/prihlaseni" element={<AuthPage mode="login" />} />
            <Route path="/registrace" element={<AuthPage mode="signup" />} />
            <Route path="/nove-heslo" element={<NewPassword />} />
            <Route path="/podpor-me" element={<Support />} />
            <Route path="/pro-podniky" element={<ForBusinesses />} />
            <Route path="/pro-podniky/ucet" element={<BusinessAccount />} />
            <Route path="/ochrana-osobnich-udaju" element={<Privacy />} />
            <Route path="/obchodni-podminky" element={<Terms />} />
            <Route path="/o-foodgo" element={<SiteInfo kind="about" />} />
            <Route path="/kontakt" element={<SiteInfo kind="contact" />} />
            <Route path="/cookies" element={<SiteInfo kind="cookies" />} />
            <Route path="/reklamni-zvyrazneni" element={<SiteInfo kind="ads" />} />
            <Route path="/admin/zadosti" element={<AdminApplications />} />
            <Route path="/admin/propagace" element={<AdminPromotions />} />
            <Route path="/admin/podniky" element={<AdminPlaces />} />
            <Route path="/admin/hlaseni" element={<AdminReports />} />
            <Route path="/admin/odmeny" element={<AdminLoyalty />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          </Suspense>
          </ErrorBoundary>
          </div>
          <footer className="site-footer">
            <p className="footer-brand">FoodGo Brno</p>
            <p className="footer-tagline">Katalog jídla v Brně. Ověřené údaje oddělujeme od odhadů.</p>
            <p className="footer-support">
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              {' · '}
              <Link to="/results">Najít podnik</Link>
              {' · '}
              <Link to="/results?view=map">Mapa</Link>
              {' · '}
              <Link to="/oblibene">Oblíbené</Link>
              {' · '}
              <Link to="/pro-podniky">Pro podniky</Link>
              {' · '}
              <Link to="/o-foodgo">O FoodGo</Link>
              {' · '}
              <Link to="/kontakt">Kontakt</Link>
              {' · '}
              <Link to="/reklamni-zvyrazneni">Reklama</Link>
              {' · '}
              <Link to="/cookies">Cookies</Link>
              {' · '}
              <Link to="/ochrana-osobnich-udaju">Ochrana osobních údajů</Link>
              {' · '}
              <Link to="/obchodni-podminky">Obchodní podmínky</Link>
            </p>
            {pixabayLibraryReady ? (
              <p className="footer-photo-credit">
                <a href="https://pixabay.com/" target="_blank" rel="noreferrer">
                  Fotografie z Pixabay
                </a>
                {' · '}
                <a href="https://unsplash.com/" target="_blank" rel="noreferrer">
                  Unsplash
                </a>
                {' · '}
                <a href="https://www.pexels.com/" target="_blank" rel="noreferrer">
                  Pexels
                </a>
              </p>
            ) : null}
            <DataSources />
          </footer>
        </div>
      </CompareProvider>
      </LocationProvider>
      </CatalogProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
