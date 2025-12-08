import { Routes, Route } from 'react-router-dom';
import Login from './components/Login.jsx'
import ViewActivity from './components/ViewActivity.jsx';
import NewActivity from './components/NewActivity.jsx';
import BatchUpload from './components/BatchUpload.jsx';
import Activities from './components/Activities.jsx'
import RouteMap from './components/RouteMap.jsx';
import Profile from './components/profile/Profile.jsx';
import NavMenu from './components/NavMenu.jsx';
// import NavMenu from './components/NavMenu.jsx';

function App() {

  return (
    <div>
      <NavMenu />
      <Routes>
        {/* Public Route (accessible without login) */}
        <Route path="/login" element={<Login />} />

        {/* Protected Route (requires login) */}
        <Route path="/" element={<Activities />} />

        <Route path="/activity/:id" element={<ViewActivity />} />
        <Route path="/activity/new" element={<NewActivity />} />
        <Route path="/batch-upload" element={<BatchUpload />} />
        <Route path="/map/:id" element={<RouteMap />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </div>
  )
}
export default App
