import React, { useState, useEffect } from 'react';
import axios from 'axios';

axios.defaults.withCredentials = true;

const App = () => {
  const [connectedToZoom, setConnectedToZoom] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [connectedToGoogle, setConnectedToGoogle] = useState(false);
  const [googleRecordings, setGoogleRecordings] = useState([]);

  const [showModal, setShowModal] = useState(false);
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    checkZoomStatus();
    checkGoogleStatus();
  }, []);

  const checkZoomStatus = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/zoom/status');
      if (response.data.connected) {
        setConnectedToZoom(true);
        fetchRecordings();
      }
    } catch (error) {
      console.error('Error checking Zoom status:', error);
    }
  };

  const checkGoogleStatus = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/google/status');
      if (response.data.connected) {
        setConnectedToGoogle(true);
        fetchGoogleRecordings();
      }
    } catch (error) {
      console.error('Error checking Google status:', error);
    }
  };

  const fetchRecordings = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/zoom/recordings');
      setRecordings(response.data.meetings || []);
    } catch (error) {
      console.error('Error fetching Zoom recordings:', error);
    }
  };

  const fetchGoogleRecordings = async () => {
    try {
      const response = await axios.get('http://localhost:4000/api/google/recordings');
      setGoogleRecordings(response.data.files || []);
    } catch (error) {
      console.error('Error fetching Google recordings:', error);
    }
  };

  const handleSignInWithZoom = () => {
    window.location.href = 'http://localhost:4000/auth/zoom';
  };

  const handleSignInWithGoogle = () => {
    window.location.href = 'http://localhost:4000/auth/google';
  };

  const handleLogout = async () => {
    try {
      await axios.get('http://localhost:4000/api/logout');
      // Reset state after logout
      setConnectedToZoom(false);
      setConnectedToGoogle(false);
      setRecordings([]);
      setGoogleRecordings([]);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  const filteredRecordings = recordings.filter((meeting) => {
    const topicMatch = meeting.topic?.toLowerCase().includes(searchTerm.toLowerCase());
    const meetingIdMatch = meeting.id?.toString().includes(searchTerm);
    return (topicMatch || meetingIdMatch);
  });

  const handleShareClick = () => {
    setShowModal(true);
  };

  const handleModalConnect = () => {
    setUploading(true);
    setUploadProgress(0);

    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev < 100) {
          return prev + 5;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            setUploading(false);
            setShowModal(false);
            setUserId('');
            setPassword('');
          }, 500);
          return prev;
        }
      });
    }, 100);
  };

  // If not connected to either Zoom or Google, show sign-in page
  if (!connectedToZoom && !connectedToGoogle) {
    return (
      <div style={styles.signInContainer}>
        <div style={styles.signInBox}>
          <div style={styles.signInLeft}>
            <h2 style={{color: '#fff', marginBottom: '20px'}}>Workplace</h2>
            <p style={{color: '#fff', fontSize: '14px', lineHeight: '1.5'}}>
              Work happy with AI Companion 2.0 (coming soon)  
              <br/><br/>
              Get more done by surfacing important information, prioritizing what matters most,
              and turning every interaction into action with your AI personal assistant.
            </p>
            <button style={styles.transformBtn}>Transform your workday</button>
          </div>
          <div style={styles.signInRight}>
            <h2 style={styles.signInTitle}>Sign In</h2>
            <p style={styles.dividerText}>Or sign in with</p>
            <div style={styles.socialButtons}>
              <button style={styles.ssoBtn} onClick={handleSignInWithZoom}>
                <img
                  src={process.env.PUBLIC_URL + '/zoom.svg'}
                  alt="Zoom SSO"
                  style={{ width: "30px", height: "30px" }}
                />
              </button>
              <button style={styles.ssoBtn} onClick={handleSignInWithGoogle}>
                <img
                  src={process.env.PUBLIC_URL + '/google.svg'}
                  alt="Google SSO"
                  style={{ width: "30px", height: "30px" }}
                />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If connected to at least one service, show recordings page
  return (
    <div style={styles.appContainer}>
      <div style={styles.sidebar}>
        <h1 style={styles.logo}>My App</h1>
        <nav style={styles.nav}>
          <a href="#profile" style={styles.navLink}>Profile</a>
          <a href="#recordings" style={styles.navLink}>Recordings</a>
        </nav>
      </div>

      <div style={styles.mainContent}>
        <div style={styles.profileHeader}>
          <div style={styles.profileInfo}>
            <img
              src="https://via.placeholder.com/40"
              alt="User Avatar"
              style={styles.avatar}
            />
            <div>
              <h2 style={styles.userName}>Aritra Das</h2>
              <p style={styles.planInfo}>Current Plan: Workplace Basic</p>
            </div>
          </div>
          {/* Logout button at top-right */}
          <button onClick={handleLogout} style={styles.logoutBtn}>Logout</button>
        </div>

        <div style={styles.bodyContent}>
          {connectedToZoom && (
            <div style={styles.recordingsContainer}>
              <h2 style={styles.headerTitle}>Zoom Recordings and Transcripts</h2>
              <div style={styles.tabs}>
                <div style={{ ...styles.tab, ...styles.activeTab }}>Cloud recordings</div>
              </div>

              <div style={styles.topBar}>
                <div style={styles.searchRow}>
                  <input
                    type="text"
                    placeholder="Search by topic or meeting ID"
                    style={styles.searchInput}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <div style={styles.iconsRow}>
                  <span style={styles.iconBtn}>Trash (0)</span>
                  <span style={styles.iconBtn}>Document</span>
                </div>
              </div>

              <div style={styles.viewControlsRow}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <button style={styles.viewToggleBtn}>▦</button>
                  <button style={{ ...styles.viewToggleBtn, ...styles.activeViewToggle }}>▤</button>
                  <button style={styles.exportBtn}>Export</button>
                </div>
              </div>

              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Thumbnail</th>
                      <th style={styles.th}>Topic</th>
                      <th style={styles.th}>Meeting ID</th>
                      <th style={styles.th}>Start time</th>
                      <th style={styles.th}>Participants</th>
                      <th style={styles.th}>File size</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRecordings.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={styles.noResultsCell}>No recordings found.</td>
                      </tr>
                    ) : (
                      filteredRecordings.map((meeting) => {
                        const recordingFile = meeting.recording_files && meeting.recording_files[0];
                        const thumbnailURL = recordingFile?.thumbnail_url || 'https://via.placeholder.com/150x80';

                        const totalSize = meeting.recording_files
                          ? meeting.recording_files.reduce((acc, f) => acc + (f.file_size || 0), 0)
                          : 0;
                        const sizeKB = (totalSize / 1024).toFixed(0);
                        const filesCount = meeting.recording_files ? meeting.recording_files.length : 0;

                        return (
                          <tr key={meeting.uuid} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input type="checkbox" />
                                <div style={styles.thumbnailWrapper}>
                                  <img src={thumbnailURL} alt="Recording Thumbnail" style={styles.thumbnailImage} />
                                  <div style={styles.thumbOverlay}>
                                    <span style={styles.overlayItem}>👁️ 0</span>
                                    <span style={styles.overlayItem}>00:00:11</span>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={styles.td}>{meeting.topic}</td>
                            <td style={styles.td}>{meeting.id}</td>
                            <td style={styles.td}>{formatDate(meeting.start_time)}</td>
                            <td style={styles.td}>
                              <div style={styles.participantIcon}>R</div>
                            </td>
                            <td style={styles.td}>{filesCount} {filesCount === 1 ? 'File' : 'Files'} ({sizeKB} KB)</td>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button style={styles.iconZoomInfoActionBtn} onClick={handleShareClick}>
                                  <img
                                    src={process.env.PUBLIC_URL + '/zoominfo-Logo.png'}
                                    alt="ZoomInfo"
                                    style={{ width: "70px", height: "35px" }}
                                  />
                                </button>
                                <button style={styles.iconGongInfoActionBtn}>
                                  <img
                                    src={process.env.PUBLIC_URL + '/gong.png'}
                                    alt="Gong"
                                    style={{ width: "70px", height: "35px" }}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={styles.paginationRow}>
                <div style={styles.paginationControls}>
                  <button style={styles.paginationBtn} disabled>←</button>
                  <span>{filteredRecordings.length} result(s)</span>
                  <button style={styles.paginationBtn} disabled>→</button>
                </div>
              </div>
            </div>
          )}

          {connectedToGoogle && (
            <div style={styles.recordingsContainer}>
              <h2 style={styles.headerTitle}>Google Meet Recordings (Google Drive)</h2>
              <div style={styles.tabs}>
                <div style={{ ...styles.tab, ...styles.activeTab }}>Drive Videos</div>
              </div>

              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Thumbnail</th>
                      <th style={styles.th}>Name</th>
                      <th style={styles.th}>Created Time</th>
                      <th style={styles.th}>Size (KB)</th>
                      <th style={styles.th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {googleRecordings.length === 0 ? (
                      <tr>
                        <td colSpan="5" style={styles.noResultsCell}>No recordings found in Google Drive.</td>
                      </tr>
                    ) : (
                      googleRecordings.map((file) => {
                        const sizeKB = file.size ? (file.size / 1024).toFixed(0) : 0;
                        return (
                          <tr key={file.id} style={styles.tr}>
                            <td style={styles.td}>
                              <div style={styles.thumbnailWrapper}>
                                {file.thumbnailLink ? (
                                  <img src={file.thumbnailLink} alt="Thumbnail" style={styles.thumbnailImage} />
                                ) : (
                                  <div style={{...styles.thumbnailWrapper, display:'flex',justifyContent:'center',alignItems:'center'}}>No Thumbnail</div>
                                )}
                              </div>
                            </td>
                            <td style={styles.td}>{file.name}</td>
                            <td style={styles.td}>{formatDate(file.createdTime)}</td>
                            <td style={styles.td}>{sizeKB} KB</td>
                            <td style={styles.td}>
                              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                <button style={styles.iconZoomInfoActionBtn} onClick={handleShareClick}>
                                  <img
                                    src={process.env.PUBLIC_URL + '/zoominfo-Logo.png'}
                                    alt="ZoomInfo"
                                    style={{ width: "70px", height: "35px" }}
                                  />
                                </button>
                                <button style={styles.iconGongInfoActionBtn}>
                                  <img
                                    src={process.env.PUBLIC_URL + '/gong.png'}
                                    alt="Gong"
                                    style={{ width: "70px", height: "35px" }}
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>

      {showModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            {uploading ? (
              <div>
                <p style={{marginBottom: '20px', textAlign:'center'}}>Uploading your file...</p>
                <div style={styles.progressBarContainer}>
                  <div style={{...styles.progressBarFill, width: ${uploadProgress}%}}></div>
                </div>
              </div>
            ) : (
              <>
                <h3>Connect to Zoom Info</h3>
                <input
                  type="text"
                  placeholder="User ID"
                  style={styles.modalInput}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                />
                <input
                  type="password"
                  placeholder="Password"
                  style={styles.modalInput}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}>
                  <button style={styles.modalBtn} onClick={() => setShowModal(false)}>Cancel</button>
                  <button style={styles.modalBtn} onClick={handleModalConnect}>Connect</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const styles = {
  signInContainer: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    backgroundColor: '#f6f6f6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  signInBox: {
    display: 'flex',
    width: '80%',
    maxWidth: '1000px',
    backgroundColor: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  signInLeft: {
    flex: 1,
    background: 'linear-gradient(135deg, #1C1D21 0%, #0E71EB 100%)',
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  transformBtn: {
    marginTop: '20px',
    padding: '10px 20px',
    backgroundColor: '#fff',
    color: '#0E71EB',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold'
  },
  signInRight: {
    flex: 1,
    padding: '40px',
    display: 'flex',
    flexDirection: 'column'
  },
  signInTitle: {
    marginBottom: '20px',
    fontSize: '24px',
    color: '#333'
  },
  dividerText: {
    fontSize: '14px',
    color: '#333',
    textAlign: 'left',
    marginBottom: '20px'
  },
  socialButtons: {
    display: 'flex',
    gap: '20px',
    justifyContent: 'flex-start'
  },
  ssoBtn: {
    padding: '10px 20px',
    border: '1px solid #ddd',
    backgroundColor: '#fff',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px'
  },

  // Main app styles after sign-in
  appContainer: {
    display: 'flex',
    fontFamily: 'sans-serif',
    height: '100vh',
    backgroundColor: '#f6f6f6',
    overflow: 'hidden',
    position: 'relative'
  },
  sidebar: {
    width: '220px',
    backgroundColor: '#ffffff',
    borderRight: '1px solid #ddd',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 0',
    alignItems: 'center',
    flexShrink: 0
  },
  logo: {
    textAlign: 'center',
    fontSize: '1.2rem',
    marginBottom: '40px',
    color: '#333'
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    marginTop: '20px'
  },
  navLink: {
    display: 'block',
    padding: '10px 20px',
    textDecoration: 'none',
    color: '#333',
    margin: '5px 0'
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    padding: '20px',
    overflowY: 'auto'
  },
  profileHeader: {
    backgroundColor: '#ffffff',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    position: 'relative'
  },
  profileInfo: {
    display: 'flex',
    alignItems: 'center'
  },
  avatar: {
    borderRadius: '50%',
    width: '40px',
    height: '40px',
    marginRight: '15px'
  },
  userName: {
    fontSize: '1.1rem',
    margin: '0 0 5px 0',
    color: '#333'
  },
  planInfo: {
    margin: 0,
    fontSize: '0.9rem',
    color: '#666'
  },
  logoutBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    padding: '10px 20px',
    border: '1px solid #ddd',
    backgroundColor: '#696867',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    color: '#fff'
  },
  bodyContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },

  recordingsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
  },
  headerTitle: {
    fontSize: '1.2rem',
    marginBottom: '20px',
    color: '#333',
    fontWeight: 'normal'
  },
  tabs: {
    display: 'flex',
    marginBottom: '20px',
    borderBottom: '1px solid #e5e5e5'
  },
  tab: {
    padding: '10px 15px',
    cursor: 'pointer',
    color: '#333',
    fontSize: '14px'
  },
  activeTab: {
    borderBottom: '2px solid #0e71eb',
    fontWeight: 'bold'
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '15px'
  },
  searchRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  searchInput: {
    padding: '8px 10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '14px',
    width: '220px'
  },
  iconsRow: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center'
  },
  iconBtn: {
    fontSize: '14px',
    color: '#333'
  },
  viewControlsRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: '15px'
  },
  viewToggleBtn: {
    padding: '5px 8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '14px'
  },
  activeViewToggle: {
    borderColor: '#0e71eb'
  },
  exportBtn: {
    marginLeft: '10px',
    padding: '5px 10px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: '14px'
  },
  tableContainer: {
    border: '1px solid #e5e5e5',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '14px'
  },
  th: {
    textAlign: 'left',
    backgroundColor: '#f9f9f9',
    color: '#333',
    padding: '10px',
    borderBottom: '1px solid #e5e5e5',
    whiteSpace: 'nowrap'
  },
  td: {
    borderBottom: '1px solid #e5e5e5',
    padding: '10px',
    verticalAlign: 'middle',
    color: '#333'
  },
  noResultsCell: {
    textAlign: 'center',
    color: '#666'
  },
  tr: {
    backgroundColor: '#fff'
  },
  thumbnailWrapper: {
    position: 'relative',
    width: '80px',
    height: '45px',
    backgroundColor: '#000',
    borderRadius: '4px',
    overflow: 'hidden'
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover'
  },
  thumbOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#fff',
    fontSize: '12px',
    padding: '2px 5px',
    display: 'flex',
    gap: '10px',
    width: '100%',
    justifyContent: 'flex-end'
  },
  overlayItem: {
    display: 'inline-block'
  },
  participantIcon: {
    width: '25px',
    height: '25px',
    borderRadius: '50%',
    backgroundColor: '#f07c42',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: '12px'
  },
  paginationRow: {
    marginTop: '15px',
    display: 'flex',
    justifyContent: 'flex-start',
    alignItems: 'center'
  },
  paginationControls: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
    color: '#333',
    fontSize: '14px'
  },
  paginationBtn: {
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '4px',
    padding: '5px',
    cursor: 'not-allowed',
    color: '#999'
  },
  iconZoomInfoActionBtn: {
    padding: '12px 16px',
    border: 'none',
    borderRadius: '4px',
    background: '#C70039',
    cursor: 'pointer',
    fontSize: '15px'
  },
  iconGongInfoActionBtn: {
    padding: '12px 16px',
    border: 'none',
    borderRadius: '4px',
    background: 'white',
    cursor: 'pointer',
    fontSize: '15px',
    transition: 'opacity .4s'
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top:0,
    left:0,
    width:'100%',
    height:'100%',
    backgroundColor:'rgba(0,0,0,0.5)',
    display:'flex',
    justifyContent:'center',
    alignItems:'center',
    zIndex:1000
  },
  modalContent: {
    background:'#fff',
    padding:'20px',
    borderRadius:'8px',
    width:'300px',
    display:'flex',
    flexDirection:'column',
    gap:'10px'
  },
  modalInput: {
    padding:'8px',
    border:'1px solid #ddd',
    borderRadius:'4px'
  },
  modalBtn: {
    padding:'8px 12px',
    border:'1px solid #ddd',
    borderRadius:'4px',
    background:'#fff',
    cursor:'pointer',
    fontSize:'14px'
  },
  progressBarContainer: {
    width:'100%',
    height:'10px',
    backgroundColor:'#eee',
    borderRadius:'4px',
    overflow:'hidden'
  },
  progressBarFill: {
    height:'100%',
    backgroundColor:'green',
    transition:'width 0.1s linear'
  }
};

export default App;