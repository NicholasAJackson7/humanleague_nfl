import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Nav from './components/Nav.jsx';

const Home = lazy(() => import('./pages/Home.jsx'));
const Stats = lazy(() => import('./pages/Stats.jsx'));
const Wheel = lazy(() => import('./pages/Wheel.jsx'));
const Rules = lazy(() => import('./pages/Rules.jsx'));
const HeadToHead = lazy(() => import('./pages/HeadToHead.jsx'));

function PageFallback() {
  return (
    <div className="page">
      <div className="skeleton" style={{ height: 28, width: '40%' }} />
      <div className="skeleton" style={{ height: 18, width: '70%' }} />
      <div className="card-grid" style={{ marginTop: 12 }}>
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 120 }} />
        <div className="skeleton" style={{ height: 120 }} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <>
      <Nav />
      <main className="app-shell">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/wheel" element={<Wheel />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/h2h" element={<HeadToHead />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>
    </>
  );
}
