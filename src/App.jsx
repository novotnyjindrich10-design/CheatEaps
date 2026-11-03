import { BrowserRouter, Link, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Results from './pages/Results'
import RestaurantDetail from './pages/RestaurantDetail'
import Support from './pages/ForBusiness'
import ForBusinesses from './pages/ForBusinesses'
import AdminApplications from './pages/AdminApplications'
import { LocationProvider } from './context/LocationContext'
import { AuthProvider } from './context/AuthContext'
import { CatalogProvider } from './context/CatalogContext'
import DataSources from './components/DataSources'
import { pixabayLibraryReady } from './data/pixabayLibrary'
import AuthPage from './pages/AuthPage'
import NewPassword from './pages/NewPassword'
import DealDetail from './pages/DealDetail'
import Favorites from './pages/Favorites'
import Rewards from './pages/Rewards'
import AdminLoyalty from './pages/AdminLoyalty'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import RecoveryRedirect from './components/RecoveryRedirect'
import PageMeta from './components/PageMeta'
import Compare from './pages/Compare'
import CompareBar from './components/CompareBar'
import { CompareProvider } from './context/CompareContext'

function NotFound() {
  return (
    <main className="page">
      <h1 className="section-title">Stránka nenalezena</h1>
      <p className="section-desc">Tahle adresa v CheapEats není.</p>
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
          <RecoveryRedirect />
          <PageMeta />
          <Header />
          <CompareBar />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results" element={<Results />} />
            <Route path="/restaurant/:id" element={<RestaurantDetail />} />
            <Route path="/oblibene" element={<Favorites />} />
            <Route path="/porovnani" element={<Compare />} />
            <Route path="/odmeny" element={<Rewards />} />
            <Route path="/nabidka/:dealId" element={<DealDetail />} />
            <Route path="/prihlaseni" element={<AuthPage mode="login" />} />
            <Route path="/registrace" element={<AuthPage mode="signup" />} />
            <Route path="/nove-heslo" element={<NewPassword />} />
            <Route path="/podpor-me" element={<Support />} />
            <Route path="/pro-podniky" element={<ForBusinesses />} />
            <Route path="/ochrana-osobnich-udaju" element={<Privacy />} />
            <Route path="/obchodni-podminky" element={<Terms />} />
            <Route path="/admin/zadosti" element={<AdminApplications />} />
            <Route path="/admin/odmeny" element={<AdminLoyalty />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <footer className="site-footer">
            <p className="footer-brand">CheapEats Brno</p>
            <p className="footer-tagline">Katalog jídla v Brně. Ověřené údaje oddělujeme od odhadů.</p>
            <p className="footer-support">
              <Link to="/results">Najít jídlo</Link>
              {' · '}
              <Link to="/odmeny">Slevy a body</Link>
              {' · '}
              <Link to="/pro-podniky">Pro podniky</Link>
              {' · '}
              <Link to="/podpor-me">Podpoř mě</Link>
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
