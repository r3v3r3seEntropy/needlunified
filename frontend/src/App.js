// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import HomePage from "./components/HomePage";
import NeedlText from "./components/NeedlText";
import NeedlVideo from "./components/NeedlVideo";

function App() {
  return (
    <Router>
      <div style={styles.navbar}>
        <Link to="/" style={styles.link}>Home</Link>
        <Link to="/text" style={styles.link}>Needl Text</Link>
        <Link to="/video" style={styles.link}>Needl Video</Link>
      </div>

      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/text" element={<NeedlText />} />
        <Route path="/video" element={<NeedlVideo />} />
      </Routes>
    </Router>
  );
}

const styles = {
  navbar: {
    display: 'flex',
    gap: '20px',
    padding: '10px',
    background: '#eee'
  },
  link: {
    textDecoration: 'none',
    color: 'blue'
  }
};

export default App;
