import { Routes, Route } from 'react-router-dom';
import Login from './components/Login.jsx'
import ViewActivity from './components/ViewActivity.jsx';
import NewActivity from './components/NewActivity.jsx';
import Activities from './components/Activities.jsx'
import RouteMap from './components/RouteMap.jsx';
import AuthCallback from './pages/AuthCallback.jsx';
// import NavMenu from './components/NavMenu.jsx';

function App() {
     
  return (
    <div>
      <Routes>
        {/* Public Route (accessible without login) */}
        <Route path="/login" element={<Login /> } />
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Protected Route (requires login) */}
        <Route path="/" element={<Activities />} />

        <Route path="/activity/:id" element={<ViewActivity />} />
        <Route path="/activity/new" element={<NewActivity />} />
        <Route path="/map/:id" element={<RouteMap />} />
      </Routes>
    </div>
   )
}
export default App
