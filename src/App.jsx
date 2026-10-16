import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Header from './components/Header'
import Home from './pages/Home'
import Results from './pages/Results'
import RestaurantDetail from './pages/RestaurantDetail'
import ForBusiness from './pages/ForBusiness'
import { LocationProvider } from './context/LocationContext'
import DataSources from './components/DataSources'

function App() {
  return (
    <BrowserRouter>
      <LocationProvider>
        <div className="app">
          <Header />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/results" element={<Results />} />
            <Route path="/restaurant/:id" element={<RestaurantDetail />} />
            <Route path="/pro-podniky" element={<ForBusiness />} />
          </Routes>
          <footer className="site-footer">
            <p>CheapEats Brno · studentský projekt · MVP</p>
            <DataSources />
          </footer>
        </div>
      </LocationProvider>
    </BrowserRouter>
  )
}

export default App
