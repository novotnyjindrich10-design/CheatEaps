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
import AuthPage from './pages/AuthPage'
import NewPassword from './pages/NewPassword'
import DealDetail from './pages/DealDetail'
import Favorites from './pages/Favorites'
import RecoveryRedirect from './components/RecoveryRedirect'

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
        <div className="app">
          <RecoveryRedirect />
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results" element={<Results />} />
            <Route path="/restaurant/:id" element={<RestaurantDetail />} />
            <Route path="/oblibene" element={<Favorites />} />
            <Route path="/nabidka/:dealId" element={<DealDetail />} />
            <Route path="/prihlaseni" element={<AuthPage mode="login" />} />
            <Route path="/registrace" element={<AuthPage mode="signup" />} />
            <Route path="/nove-heslo" element={<NewPassword />} />
            <Route path="/podpor-me" element={<Support />} />
            <Route path="/pro-podniky" element={<ForBusinesses />} />
            <Route path="/admin/zadosti" element={<AdminApplications />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <footer className="site-footer">
            <p>CheapEats Brno · studentský projekt · MVP</p>
            <p className="footer-support">
              <Link to="/pro-podniky">Pro podniky</Link>
              {' · '}
              <Link to="/podpor-me">Podpoř mě</Link>
            </p>
            <DataSources />
          </footer>
        </div>
      </LocationProvider>
      </CatalogProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
