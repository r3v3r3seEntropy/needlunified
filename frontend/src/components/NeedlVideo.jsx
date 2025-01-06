// src/components/NeedlVideo.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// ------------------------ Loading Spinner ------------------------
const LoadingSpinner = () => (
  <div style={{ textAlign: 'center', marginTop: '50px' }}>
    <p>Loading...</p>
  </div>
);

// ------------------------ VideoMeetingFrame ------------------------
const VideoMeetingFrame = ({ roomUrl, isHost }) => {
  const iframeRef = useRef(null);

  useEffect(() => {
    if (iframeRef.current) {
      iframeRef.current.src = roomUrl;
    }
  }, [roomUrl]);

  return (
    <div
      style={{
        width: '100%',
        height: '600px',
        backgroundColor: '#000',
        borderRadius: '8px',
        overflow: 'hidden',
        marginBottom: '20px',
      }}
    >
      <iframe
        ref={iframeRef}
        src={roomUrl}
        allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
        }}
        title={isHost ? 'Host Meeting Room' : 'Participant Meeting Room'}
      />
    </div>
  );
};

// ------------------------ ActiveMeetingContainer ------------------------
const ActiveMeetingContainer = ({
  activeRoom,
  isHost,
  handleEndCall,
  handleFetchRecordings,
}) => {
  return (
    <div style={styles.activeCallContainer}>
      <div style={styles.callHeader}>
        <h2 style={styles.callTitle}>
          Active Meeting ({isHost ? 'Host' : 'Participant'})
        </h2>
        <div style={styles.callControls}>
          <button style={styles.endCallButton} onClick={handleEndCall}>
            {isHost ? 'End Meeting' : 'Leave Meeting'}
          </button>

          {isHost && (
            <button style={styles.fetchRecordingButton} onClick={handleFetchRecordings}>
              View Recordings
            </button>
          )}
        </div>
      </div>

      <VideoMeetingFrame
        roomUrl={isHost ? activeRoom.hostUrl : activeRoom.viewerUrl}
        isHost={isHost}
      />

      {isHost && (
        <div style={styles.meetingLinkBox}>
          <h3 style={styles.linkTitle}>Share Meeting Link</h3>
          <div style={styles.linkContainer}>
            <input
              type="text"
              value={activeRoom.viewerUrl}
              readOnly
              style={styles.linkInput}
            />
            <button
              style={styles.copyButton}
              onClick={() => {
                navigator.clipboard.writeText(activeRoom.viewerUrl);
                toast.success('Meeting link copied to clipboard!');
              }}
            >
              Copy Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ------------------------ Main Video Component ------------------------
function NeedlVideo() {
  // Auth States
  const [connectedToGoogle, setConnectedToGoogle] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Video Call States
  const [activeRoom, setActiveRoom] = useState(null);
  const [isHost, setIsHost] = useState(true);
  const [meetingUrl, setMeetingUrl] = useState('');

  // Whereby recordings (and the user-added .transcription field)
  const [wherebyRecordings, setWherebyRecordings] = useState([]);

  // ----------------------- On Load: Check Google Status -----------------------
  useEffect(() => {
    checkGoogleStatus();
  }, []);

  const checkGoogleStatus = async () => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const error = urlParams.get('error');
      if (error === 'auth_failed') {
        throw new Error('Authentication failed. Please try again.');
      }

      // Fetch status from FLASK: 5000
      const response = await axios.get('http://localhost:5000/api/status', {
        withCredentials: true,
      });
      if (response.data.authenticated) {
        setConnectedToGoogle(true);
        setUser(response.data.user);
        toast.success('Successfully logged in!');
      }
    } catch (error) {
      console.error('Error checking status:', error);
      setAuthError(error.message || 'Failed to authenticate. Please try again.');
      toast.error(error.message || 'Authentication failed. Please try again.');
    } finally {
      // remove query params from URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setLoading(false);
    }
  };

  // ----------------------- Auth: Sign In/Out -----------------------
  const handleSignInWithGoogle = async () => {
    try {
      setLoading(true);
      window.location.href = 'http://localhost:5000/auth/google';
    } catch (error) {
      console.error('Error initiating Google sign-in:', error);
      toast.error('Failed to start Google sign-in. Please try again.');
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await axios.get('http://localhost:5000/api/logout', {
        withCredentials: true,
      });
      setConnectedToGoogle(false);
      setUser(null);
      setActiveRoom(null);
      setWherebyRecordings([]);
      toast.success('Successfully logged out!');
    } catch (error) {
      console.error('Error logging out:', error);
      toast.error('Error logging out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------- Create / Join Meeting -----------------------
  const startCall = async () => {
    try {
      setLoading(true);
      const response = await axios.post(
        'http://localhost:5000/api/video/create-room',
        {},
        { withCredentials: true }
      );

      if (response.data.success) {
        setActiveRoom(response.data.room);
        setIsHost(true);
        toast.success('Meeting room created successfully!');
      }
    } catch (error) {
      console.error('Error creating room:', error);
      toast.error('Failed to create meeting room. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const joinCall = (e) => {
    e.preventDefault();
    if (meetingUrl) {
      setActiveRoom({
        hostUrl: meetingUrl,
        viewerUrl: meetingUrl,
      });
      setIsHost(false);
      toast.success('Joined meeting successfully!');
    } else {
      toast.error('Please enter a valid meeting URL');
    }
  };

  const endCall = () => {
    setActiveRoom(null);
    setMeetingUrl('');
    toast.info(isHost ? 'Meeting ended' : 'Left the meeting');
  };

  // ----------------------- Fetch Recordings from Whereby -----------------------
  const handleFetchRecordings = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(
        'http://localhost:5000/api/video/recordings',
        { withCredentials: true }
      );
      if (data.success) {
        setWherebyRecordings(data.recordings);
        toast.success('Fetched Whereby recordings');
      }
    } catch (error) {
      console.error('Error fetching recordings:', error);
      toast.error('Failed to fetch recordings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ----------------------- Transcribe a Recording (Gemini) -----------------------
  const handleTranscribe = async (recordingIndex) => {
    if (!wherebyRecordings[recordingIndex]?.id) {
      toast.error('No valid recording found');
      return;
    }
    try {
      toast.info('Transcription in progress...');
      const { data } = await axios.get(
        `http://localhost:5000/api/recordings/${wherebyRecordings[recordingIndex].id}/transcribe`,
        { withCredentials: true }
      );
      if (data.success) {
        // Insert the returned transcription into the recordings array
        const updated = [...wherebyRecordings];
        updated[recordingIndex].transcription = data.transcription;
        setWherebyRecordings(updated);

        toast.success('Transcription complete!');
      }
    } catch (error) {
      console.error('Error transcribing recording:', error);
      toast.error('Failed to transcribe. Please try again.');
    }
  };

  // ----------------------- Render -----------------------
  if (loading) {
    return <LoadingSpinner />;
  }

  // If not logged in, show login
  if (!connectedToGoogle) {
    return (
      <div style={styles.loginContainer}>
        <ToastContainer position="top-right" />
        <div style={styles.loginBox}>
          <div style={styles.loginLeft}>
            <h1 style={styles.loginTitle}>Needl Video</h1>
            <p style={styles.loginDescription}>Health AI made simple</p>
            <div style={styles.loginFeatures}>
              <div style={styles.featureItem}>✓ HD Video Calls</div>
              <div style={styles.featureItem}>✓ Built-in Recording</div>
              <div style={styles.featureItem}>✓ Auto Transcription</div>
            </div>
          </div>
          <div style={styles.loginRight}>
            <h2 style={styles.welcomeText}>Welcome Back</h2>
            <p style={styles.signInText}>Sign in to continue</p>
            {authError && <div style={styles.errorMessage}>{authError}</div>}
            <button
              style={styles.googleButton}
              onClick={handleSignInWithGoogle}
              disabled={loading}
            >
              {loading ? 'Connecting...' : 'Continue with Google'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated UI
  return (
    <div style={styles.appContainer}>
      <ToastContainer position="top-right" />

      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h1 style={styles.logo}>Needl Video</h1>
        </div>

        <div style={styles.userProfile}>
          <img src={user?.picture} alt="Profile" style={styles.profileImage} />
          <div style={styles.userInfo}>
            <h3 style={styles.userName}>{user?.name}</h3>
            <p style={styles.userEmail}>{user?.email}</p>
          </div>
        </div>

        <nav style={styles.navigation}>
          <button style={{ ...styles.navButton, ...styles.activeNavButton }}>
            Dashboard
          </button>
          <button style={styles.navButton}>Recordings</button>
          <button style={styles.navButton}>Settings</button>
        </nav>

        <button style={styles.logoutButton} onClick={handleLogout}>
          {loading ? 'Signing Out...' : 'Sign Out'}
        </button>
      </div>

      {/* Main Content */}
      <div style={styles.mainContent}>
        <div style={styles.header}>
          <div style={styles.viewToggle}>
            <button
              style={{
                ...styles.toggleButton,
                ...(isHost ? styles.toggleButtonActive : {}),
              }}
              onClick={() => setIsHost(true)}
            >
              Host Meeting
            </button>
            <button
              style={{
                ...styles.toggleButton,
                ...(!isHost ? styles.toggleButtonActive : {}),
              }}
              onClick={() => setIsHost(false)}
            >
              Join Meeting
            </button>
          </div>
        </div>

        <div style={styles.contentArea}>
          {/* Meeting Container (Host or Join) */}
          <div style={styles.meetingContainer}>
            {!activeRoom ? (
              <div style={styles.startMeetingBox}>
                <h2 style={styles.startMeetingTitle}>
                  {isHost ? 'Start a New Meeting' : 'Join a Meeting'}
                </h2>
                {isHost ? (
                  <button
                    style={styles.startMeetingButton}
                    onClick={startCall}
                    disabled={loading}
                  >
                    {loading ? 'Creating Room...' : 'Start New Meeting'}
                  </button>
                ) : (
                  <form onSubmit={joinCall} style={styles.joinForm}>
                    <input
                      type="text"
                      placeholder="Enter meeting link"
                      value={meetingUrl}
                      onChange={(e) => setMeetingUrl(e.target.value)}
                      style={styles.joinInput}
                    />
                    <button type="submit" style={styles.joinButton}>
                      Join Meeting
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <ActiveMeetingContainer
                activeRoom={activeRoom}
                isHost={isHost}
                handleEndCall={endCall}
                handleFetchRecordings={handleFetchRecordings}
              />
            )}
          </div>

          {/* Whereby Recordings & Transcriptions */}
          {wherebyRecordings.length > 0 && (
            <div style={styles.recordingsSection}>
              <h2 style={styles.recordingsTitle}>Whereby Recordings</h2>
              <div style={styles.recordingsGrid}>
                {wherebyRecordings.map((rec, idx) => (
                  <div key={idx} style={styles.videoCard}>
                    <p>
                      <strong>Started:</strong>{' '}
                      {new Date(rec.startedAt).toLocaleString()}
                    </p>
                    <p>
                      <strong>Ended:</strong>{' '}
                      {new Date(rec.endedAt).toLocaleString()}
                    </p>
                    <p>
                      <strong>File URL:</strong>{' '}
                      <a href={rec.fileUrl} target="_blank" rel="noreferrer">
                        Open
                      </a>
                    </p>
                    <p>
                      <strong>Download:</strong>{' '}
                      <a href={rec.downloadUrl} target="_blank" rel="noreferrer">
                        Download
                      </a>
                    </p>

                    {rec.transcription ? (
                      <div style={styles.transcriptionBox}>
                        <h4 style={styles.transcriptionTitle}>Transcription:</h4>
                        <p style={styles.transcriptionText}>
                          {rec.transcription}
                        </p>
                      </div>
                    ) : (
                      <button
                        style={styles.transcribeButton}
                        onClick={() => handleTranscribe(idx)}
                      >
                        Transcribe
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ------------------------ Styles for NeedlVideo ------------------------
const styles = {
  // General
  appContainer: {
    display: 'flex',
    height: '100vh',
    background: '#f5f5f5',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
  },
  loginContainer: {
    height: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f5f5',
  },
  loginBox: {
    display: 'flex',
    width: '900px',
    height: '500px',
    background: '#fff',
    borderRadius: '20px',
    overflow: 'hidden',
    boxShadow: '0 10px 20px rgba(0,0,0,0.1)',
  },
  loginLeft: {
    flex: 1,
    padding: '40px',
    background: 'linear-gradient(135deg, #1C1D21 0%, #0E71EB 100%)',
    color: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  loginTitle: {
    fontSize: '32px',
    marginBottom: '20px',
  },
  loginDescription: {
    fontSize: '16px',
    lineHeight: '1.6',
    marginBottom: '30px',
  },
  loginFeatures: {
    marginTop: '20px',
  },
  featureItem: {
    margin: '10px 0',
    fontSize: '16px',
  },
  loginRight: {
    flex: 1,
    padding: '40px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: '24px',
    color: '#333',
    marginBottom: '10px',
  },
  signInText: {
    color: '#666',
    marginBottom: '30px',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 24px',
    background: '#fff',
    border: '1px solid #ddd',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    transition: 'all 0.3s ease',
  },

  // Sidebar
  sidebar: {
    width: '260px',
    background: '#fff',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #eee',
  },
  sidebarHeader: {
    marginBottom: '30px',
  },
  logo: {
    fontSize: '24px',
    color: '#333',
  },
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    padding: '15px',
    background: '#f8f9fa',
    borderRadius: '12px',
    marginBottom: '30px',
  },
  profileImage: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    marginRight: '12px',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: '16px',
    color: '#333',
    marginBottom: '4px',
  },
  userEmail: {
    fontSize: '14px',
    color: '#666',
  },
  navigation: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },
  navButton: {
    padding: '12px',
    textAlign: 'left',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    color: '#666',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  activeNavButton: {
    background: '#f0f7ff',
    color: '#0E71EB',
  },
  logoutButton: {
    padding: '12px',
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px',
    marginTop: 'auto',
  },

  // Main Content
  mainContent: {
    flex: 1,
    padding: '30px',
    overflowY: 'auto',
  },
  header: {
    marginBottom: '30px',
  },
  viewToggle: {
    display: 'flex',
    gap: '10px',
  },
  toggleButton: {
    padding: '10px 20px',
    background: '#fff',
    border: '1px solid #0E71EB',
    borderRadius: '8px',
    color: '#0E71EB',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.3s ease',
  },
  toggleButtonActive: {
    background: '#0E71EB',
    color: '#fff',
  },
  contentArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },

  // Meeting container
  meetingContainer: {
    background: '#fff',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  startMeetingBox: {
    textAlign: 'center',
    padding: '40px',
  },
  startMeetingTitle: {
    fontSize: '24px',
    color: '#333',
    marginBottom: '20px',
  },
  startMeetingButton: {
    padding: '12px 24px',
    background: '#0E71EB',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
  },
  joinForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    alignItems: 'center',
  },
  joinInput: {
    padding: '12px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '16px',
    width: '100%',
    maxWidth: '300px',
  },
  joinButton: {
    padding: '12px',
    background: '#0E71EB',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    cursor: 'pointer',
  },

  // Active call container
  activeCallContainer: {
    background: '#fff',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '30px',
  },
  callHeader: {
    padding: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #eee',
    background: '#f8f9fa',
  },
  callTitle: {
    fontSize: '20px',
    color: '#333',
  },
  callControls: {
    display: 'flex',
    gap: '10px',
  },
  endCallButton: {
    padding: '8px 16px',
    background: '#dc3545',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  fetchRecordingButton: {
    padding: '8px 16px',
    background: '#17a2b8',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },
  meetingLinkBox: {
    padding: '20px',
    borderTop: '1px solid #eee',
  },
  linkTitle: {
    fontSize: '16px',
    color: '#333',
    marginBottom: '10px',
  },
  linkContainer: {
    display: 'flex',
    gap: '10px',
  },
  linkInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
  },
  copyButton: {
    padding: '8px 16px',
    background: '#0E71EB',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
  },

  // Recordings
  recordingsSection: {
    background: '#fff',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  recordingsTitle: {
    fontSize: '20px',
    color: '#333',
    marginBottom: '20px',
  },
  recordingsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: '20px',
  },
  videoCard: {
    border: '1px solid #eee',
    borderRadius: '8px',
    padding: '16px',
  },
  transcribeButton: {
    padding: '8px 16px',
    background: '#17a2b8',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
    marginTop: '10px',
  },
  transcriptionBox: {
    background: '#f8f9fa',
    padding: '10px',
    borderRadius: '6px',
    marginTop: '10px',
  },
  transcriptionTitle: {
    fontSize: '14px',
    color: '#333',
    marginBottom: '5px',
  },
  transcriptionText: {
    fontSize: '14px',
    color: '#666',
    lineHeight: '1.4',
    whiteSpace: 'pre-wrap',
  },
};

export default NeedlVideo;
