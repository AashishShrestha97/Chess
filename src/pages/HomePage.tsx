import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PlayStyleCard from "../components/HomePage/PlayStyleCard";
import TimeControlModal, {
  type TimeControl,
} from "../components/HomePage/TimeControlModal";
import VersusModal, {
  type VersusChoice,
} from "../components/HomePage/VersusModal";
import StatsPanel from "../components/HomePage/StatsPanel";
import RecentGames from "../components/HomePage/RecentGames";
import LeaderboardPromo from "../components/HomePage/LeaderboardPromo";
import VoiceTip from "../components/HomePage/VoiceTip";
import VoiceCommandsModal from "../components/HomePage/VoiceCommandModal";
import voiceCommandService from "../utils/voiceCommandService";
import speechService from "../utils/speechService";
import "./HomePage.css";
import Navbar from "../components/Navbar/Navbar";

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  // Modal states
  const [timeModalOpen, setTimeModalOpen] = useState(false);
  const [versusModalOpen, setVersusModalOpen] = useState(false);
  const [commandsModalOpen, setCommandsModalOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<"voice" | "classic" | null>(
    null
  );
  const [selectedTime, setSelectedTime] = useState<TimeControl | null>(null);

  // Voice recognition states
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");

  // Refs to track pending actions
  const pendingModeRef = useRef<"voice" | "classic" | null>(null);
  const pendingTimeRef = useRef<TimeControl | null>(null);
  const welcomePlayedRef = useRef(false);

  // Play welcome message once per session on this page
  useEffect(() => {
    if (speechService.isSupportedBrowser() && !welcomePlayedRef.current) {
      welcomePlayedRef.current = true;

      // Increased delay to ensure page is fully loaded and speech synthesis is ready
      const welcomeTimeout = setTimeout(() => {
        playWelcomeMessage();
      }, 2000);

      return () => clearTimeout(welcomeTimeout);
    }
  }, []); // Empty dependency array - only run once on mount

  // Separate cleanup effect
  useEffect(() => {
    return () => {
      speechService.stop();
    };
  }, []);

  const playWelcomeMessage = async () => {
    const welcomeText = `Welcome to Voice Chess! You can control the game with your voice. 
    Try saying "Start voice chess" to begin, or say "Show commands" to see all available voice commands. 
    Voice recognition is now active and ready to listen.`;

    try {
      await speechService.speak({
        text: welcomeText,
        rate: 1.0,
        volume: 0.9,
        onStart: () => {
          console.log("🔊 Playing welcome message");
        },
        onEnd: () => {
          console.log("✅ Welcome message complete");
        },
        onError: (err) => {
          console.warn("⚠️ Welcome speech error:", err);
        },
      });
    } catch (e) {
      console.warn("Welcome speech failed:", e);
    }
  };

  // Initialize voice commands on mount
  useEffect(() => {
    if (!voiceCommandService.isActive()) {
      startVoiceListening();
    }

    return () => {
      voiceCommandService.stopListening();
    };
  }, []);

  // Start voice listening
  const startVoiceListening = () => {
    voiceCommandService.startListening({
      continuous: true,
      interimResults: true,
      language: "en-US",
      onListeningStart: () => {
        setIsVoiceActive(true);
        console.log("Voice commands active");
      },
      onListeningStop: () => {
        setIsVoiceActive(false);
      },
      onError: (error) => {
        console.error("Voice error:", error);
      },
      onCommand: handleVoiceCommand,
      onTranscript: (transcript, isFinal) => {
        setCurrentTranscript(transcript);
        if (isFinal) {
          setTimeout(() => setCurrentTranscript(""), 2000);
        }
      },
    });
  };

  // Handle voice commands
  const handleVoiceCommand = async (command: any) => {
    console.log("Processing command:", command);

    // Provide audio feedback (this will also cancel any existing speech)
    await provideFeedback(command.intent);

    // Handle specific time control selections
    switch (command.intent) {
      case "START_VOICE_CHESS":
        handleStartVoiceChess();
        break;

      case "START_CLASSIC_CHESS":
        handleStartClassicChess();
        break;

      // Specific Bullet selections
      case "SELECT_BULLET_1_0":
        handleTimeSelection("1+0");
        break;
      case "SELECT_BULLET_1_1":
        handleTimeSelection("1+1");
        break;
      case "SELECT_BULLET_2_1":
        handleTimeSelection("2+1");
        break;
      case "SELECT_BULLET_2_0":
        handleTimeSelection("2+0");
        break;
      case "SELECT_BULLET_30_0":
        handleTimeSelection("0.5+0");
        break;

      // Specific Blitz selections
      case "SELECT_BLITZ_3_0":
        handleTimeSelection("3+0");
        break;
      case "SELECT_BLITZ_3_2":
        handleTimeSelection("3+2");
        break;
      case "SELECT_BLITZ_5_0":
        handleTimeSelection("5+0");
        break;
      case "SELECT_BLITZ_5_3":
        handleTimeSelection("5+3");
        break;
      case "SELECT_BLITZ_4_2":
        handleTimeSelection("4+2");
        break;

      // Specific Rapid selections
      case "SELECT_RAPID_10_0":
        handleTimeSelection("10+0");
        break;
      case "SELECT_RAPID_10_5":
        handleTimeSelection("10+5");
        break;
      case "SELECT_RAPID_15_10":
        handleTimeSelection("15+10");
        break;
      case "SELECT_RAPID_15_0":
        handleTimeSelection("15+0");
        break;
      case "SELECT_RAPID_25_10":
        handleTimeSelection("25+10");
        break;

      // Specific Classical selections
      case "SELECT_CLASSICAL_90_30":
        handleTimeSelection("90+30");
        break;
      case "SELECT_CLASSICAL_60_0":
        handleTimeSelection("60+0");
        break;
      case "SELECT_CLASSICAL_60_30":
        handleTimeSelection("60+30");
        break;
      case "SELECT_CLASSICAL_120_30":
        handleTimeSelection("120+30");
        break;
      case "SELECT_CLASSICAL_90_40_30":
        handleTimeSelection("90/40+30");
        break;

      // Generic category selections
      case "SELECT_BULLET":
        handleTimeSelection("1+0");
        break;
      case "SELECT_BLITZ":
        handleTimeSelection("5+3");
        break;
      case "SELECT_RAPID":
        handleTimeSelection("10+0");
        break;
      case "SELECT_CLASSICAL":
        handleTimeSelection("15+10");
        break;

      // Time control info inquiries
      case "TIME_CONTROLS_BULLET":
        await announceTimeControls("bullet");
        break;
      case "TIME_CONTROLS_BLITZ":
        await announceTimeControls("blitz");
        break;
      case "TIME_CONTROLS_RAPID":
        await announceTimeControls("rapid");
        break;
      case "TIME_CONTROLS_CLASSICAL":
        await announceTimeControls("classical");
        break;

      case "SELECT_RANDOM":
        handleOpponentSelection("random");
        break;

      case "SELECT_FRIENDS":
        handleOpponentSelection("friends");
        break;

      case "GO_BACK":
        handleGoBack();
        break;

      case "STOP_LISTENING":
        voiceCommandService.stopListening();
        speechService.stop();
        break;

      case "SHOW_COMMANDS":
        speechService.stop();
        setCommandsModalOpen(true);
        break;

      default:
        console.log("Unknown command intent:", command.intent);
    }
  };

  // Announce available time controls for a category
  const announceTimeControls = async (category: string) => {
    const timeControlInfo: { [key: string]: string } = {
      bullet:
        "Bullet time controls are: 1 plus 0, 1 plus 1, 2 plus 1, 2 plus 0, and 30 seconds plus 0",
      blitz:
        "Blitz time controls are: 3 plus 0, 3 plus 2, 5 plus 0, 5 plus 3, and 4 plus 2",
      rapid:
        "Rapid time controls are: 10 plus 0, 10 plus 5, 15 plus 10, 15 plus 0, and 25 plus 10",
      classical:
        "Classical time controls are: 90 plus 30, 60 plus 0, 60 plus 30, 120 plus 30, and 90 per 40 moves plus 30",
    };

    const message = timeControlInfo[category];
    if (message && speechService.isSupportedBrowser()) {
      try {
        await speechService.speak({
          text: message,
          rate: 1.0,
          volume: 0.9,
        });
      } catch (e) {
        console.warn("Failed to announce time controls:", e);
      }
    }
  };

  // Provide audio feedback for commands
  const provideFeedback = async (intent: string) => {
    const feedbackMessages: { [key: string]: string } = {
      START_VOICE_CHESS: "Starting voice chess",
      START_CLASSIC_CHESS: "Starting classic chess",
      SELECT_BULLET: "Bullet selected",
      SELECT_BULLET_1_0: "Bullet 1 plus 0 selected",
      SELECT_BULLET_1_1: "Bullet 1 plus 1 selected",
      SELECT_BULLET_2_1: "Bullet 2 plus 1 selected",
      SELECT_BULLET_2_0: "Bullet 2 plus 0 selected",
      SELECT_BULLET_30_0: "Bullet 30 seconds selected",
      SELECT_BLITZ: "Blitz selected",
      SELECT_BLITZ_3_0: "Blitz 3 plus 0 selected",
      SELECT_BLITZ_3_2: "Blitz 3 plus 2 selected",
      SELECT_BLITZ_5_0: "Blitz 5 plus 0 selected",
      SELECT_BLITZ_5_3: "Blitz 5 plus 3 selected",
      SELECT_BLITZ_4_2: "Blitz 4 plus 2 selected",
      SELECT_RAPID: "Rapid selected",
      SELECT_RAPID_10_0: "Rapid 10 plus 0 selected",
      SELECT_RAPID_10_5: "Rapid 10 plus 5 selected",
      SELECT_RAPID_15_10: "Rapid 15 plus 10 selected",
      SELECT_RAPID_15_0: "Rapid 15 plus 0 selected",
      SELECT_RAPID_25_10: "Rapid 25 plus 10 selected",
      SELECT_CLASSICAL: "Classical selected",
      SELECT_CLASSICAL_90_30: "Classical 90 plus 30 selected",
      SELECT_CLASSICAL_60_0: "Classical 60 plus 0 selected",
      SELECT_CLASSICAL_60_30: "Classical 60 plus 30 selected",
      SELECT_CLASSICAL_120_30: "Classical 120 plus 30 selected",
      SELECT_CLASSICAL_90_40_30: "Classical 90 per 40 moves plus 30 selected",
      TIME_CONTROLS_BULLET: "",
      TIME_CONTROLS_BLITZ: "",
      TIME_CONTROLS_RAPID: "",
      TIME_CONTROLS_CLASSICAL: "",
      SELECT_RANDOM: "Random opponent selected",
      SELECT_FRIENDS: "Play with friends selected",
      GO_BACK: "Going back",
      SHOW_COMMANDS: "Opening voice commands list",
    };

    const message = feedbackMessages[intent];
    if (message && speechService.isSupportedBrowser()) {
      try {
        await speechService.speak({
          text: message,
          rate: 1.2,
          volume: 0.8,
        });
      } catch (e) {
        console.warn("Feedback speech failed:", e);
      }
    }
  };

  // Announce versus modal options
  const announceVersusOptions = async () => {
    if (speechService.isSupportedBrowser()) {
      const announcement =
        "Choose your opponent. Say play random to play against a random opponent, or say play with friends to play with someone you know.";
      try {
        await speechService.speak({
          text: announcement,
          rate: 1.0,
          volume: 0.8,
        });
      } catch (e) {
        console.warn("Failed to announce versus options:", e);
      }
    }
  };

  // Handle start voice chess - announce time controls to blind users
  const handleStartVoiceChess = async () => {
    console.log("🎤 Starting Voice Chess");
    setSelectedMode("voice");
    pendingModeRef.current = "voice";
    setTimeModalOpen(true);
    setVersusModalOpen(false);

    // Announce available time control categories for accessibility
    if (speechService.isSupportedBrowser()) {
      const announcement =
        "Voice chess started. You can select from the following time control categories. Bullet for ultra-fast games. Blitz for fast games. Rapid for medium speed games. Or Classical for slow games. You can say the category name or say time controls followed by the category name to hear all options. For example, say time controls bullet to hear all bullet options.";
      try {
        await speechService.speak({
          text: announcement,
          rate: 1.0,
          volume: 0.8,
        });
      } catch (e) {
        console.warn("Failed to announce time controls:", e);
      }
    }
  };

  // Handle start classic chess
  const handleStartClassicChess = () => {
    console.log("♟️ Starting Classic Chess");
    setSelectedMode("classic");
    pendingModeRef.current = "classic";
    setTimeModalOpen(true);
    setVersusModalOpen(false);
  };

  // Handle time selection
  const handleTimeSelection = (time: TimeControl) => {
    console.log("⏱️ Time selected:", time);
    setSelectedTime(time);
    pendingTimeRef.current = time;

    const mode = selectedMode || pendingModeRef.current;
    if (!mode) {
      console.warn("No mode selected, defaulting to voice");
      setSelectedMode("voice");
      pendingModeRef.current = "voice";
    }

    setTimeModalOpen(false);
    setTimeout(() => {
      setVersusModalOpen(true);
      // Announce versus options after modal opens
      setTimeout(() => {
        announceVersusOptions();
      }, 300);
    }, 300);
  };

  // Handle opponent selection
  const handleOpponentSelection = (choice: VersusChoice) => {
    console.log("👥 Opponent selected:", choice);

    const mode = selectedMode || pendingModeRef.current;
    const time = selectedTime || pendingTimeRef.current;

    console.log("Navigation params:", { mode, time, choice });

    // Stop any current speech before navigating to game page
    speechService.stop();

    const gameConfig = {
      mode: mode || "voice",
      time: time,
      versus: choice,
    };
    sessionStorage.setItem("gameConfig", JSON.stringify(gameConfig));
    console.log("✅ Game config saved to sessionStorage:", gameConfig);

    setVersusModalOpen(false);

    if (mode === "voice" || !mode) {
      console.log("🎯 Navigating to /voicechess...");
      navigate("/voicechess");
    } else if (mode === "classic") {
      console.log("🎯 Navigating to /classicchess...");
      navigate("/classicchess");
    }

    setSelectedMode(null);
    setSelectedTime(null);
    pendingModeRef.current = null;
    pendingTimeRef.current = null;
  };

  // Handle go back
  const handleGoBack = () => {
    speechService.stop();

    if (versusModalOpen) {
      setVersusModalOpen(false);
      setTimeout(() => {
        setTimeModalOpen(true);
      }, 200);
    } else if (timeModalOpen) {
      setTimeModalOpen(false);
      setSelectedMode(null);
      pendingModeRef.current = null;
    }
  };

  // Click handlers (for manual interaction)
  const onStartVoice = () => {
    speechService.stop();
    handleStartVoiceChess();
  };

  const onStartClassic = () => {
    speechService.stop();
    handleStartClassicChess();
  };

  const handleTimeModalPick = (tc: TimeControl) => {
    speechService.stop();
    handleTimeSelection(tc);
  };

  const handleVersusModalPick = (choice: VersusChoice) => {
    handleOpponentSelection(choice);
  };

  return (
    <div className="home-page">
      <div>
        <Navbar rating={0} streak={0} />
      </div>

      {/* Voice Status Indicator */}
      {isVoiceActive && (
        <div className="voice-status-bar">
          <div className="voice-indicator">
            <span className="voice-dot pulsing"></span>
            <span>Voice Commands Active</span>
          </div>
          {currentTranscript && (
            <div className="voice-transcript">
              You said: "{currentTranscript}"
            </div>
          )}
        </div>
      )}

      <div className="home-container">
        {/* Header */}
        <header className="home-header">
          <div className="header-left">
            <h1 className="home-title">Welcome back, Chess Player!</h1>
            <p className="home-subtitle">
              Ready for your next game? Your current rating is 1847.
            </p>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            {/* Voice Commands Button */}
            <button
              className="voice-toggle-btn"
              onClick={() => {
                speechService.stop();
                setCommandsModalOpen(true);
              }}
              style={{
                background: "transparent",
                border: "1px solid rgba(255, 215, 0, 0.3)",
                color: "#ffd700",
              }}
            >
              📋 Commands
            </button>

            {/* Voice Toggle Button */}
            <button
              className="voice-toggle-btn"
              onClick={() => {
                if (isVoiceActive) {
                  voiceCommandService.stopListening();
                  speechService.stop();
                } else {
                  startVoiceListening();
                }
              }}
            >
              🎤 {isVoiceActive ? "Voice On" : "Voice Off"}
            </button>
          </div>
        </header>

        {/* Choose Your Play Style Section */}
        <section>
          <h2
            style={{
              fontSize: "1.3rem",
              fontWeight: 600,
              marginBottom: "16px",
              color: "#fff",
            }}
          >
            Choose Your Play Style
          </h2>
          <div className="play-modes">
            <PlayStyleCard
              variant="voice"
              badge="Featured"
              bullets={[
                "Hands-free gameplay",
                "AI-powered voice recognition",
                "Real-time move suggestions",
                "Enhanced accessibility",
              ]}
              cta="Start Voice Chess"
              onStart={onStartVoice}
            />
            <PlayStyleCard
              variant="classic"
              bullets={[
                "Classic point-and-click",
                "Multiple time controls",
                "Advanced AI analysis",
                "Tournament ready",
              ]}
              cta="Start Classic Chess"
              onStart={onStartClassic}
            />
          </div>
        </section>

        {/* Quick Stats */}
        <section style={{ marginTop: "40px" }}>
          <h3
            style={{
              fontSize: "1.3rem",
              fontWeight: 600,
              marginBottom: "16px",
              color: "#fff",
            }}
          >
            Quick Stats
          </h3>
          <div className="quick-stats">
            <div className="stat-card">
              <span className="icon">🏆</span>
              <div className="value">142</div>
              <div className="label">Games Played</div>
            </div>
            <div className="stat-card">
              <span className="icon">🎯</span>
              <div className="value">68%</div>
              <div className="label">Win Rate</div>
            </div>
            <div className="stat-card">
              <span className="icon">📊</span>
              <div className="value">1847</div>
              <div className="label">Rating</div>
            </div>
            <div className="stat-card">
              <span className="icon">🔥</span>
              <div className="value">5</div>
              <div className="label">Win Streak</div>
            </div>
          </div>
        </section>

        {/* Main Grid */}
        <div className="home-grid" style={{ marginTop: "40px" }}>
          {/* Left Column - Recent Games */}
          <div className="grid-left">
            <RecentGames />
          </div>

          {/* Right Column */}
          <div className="grid-right">
            <StatsPanel winRate={68} gamesPlayed={142} winStreak={5} />
            <LeaderboardPromo />
            <VoiceTip />
          </div>
        </div>
      </div>

      {/* Modals */}
      <TimeControlModal
        open={timeModalOpen}
        onClose={() => {
          speechService.stop();
          setTimeModalOpen(false);
          setSelectedMode(null);
          pendingModeRef.current = null;
        }}
        onPick={handleTimeModalPick}
        modeLabel={selectedMode === "voice" ? "Voice Chess" : "Classic Chess"}
      />

      <VersusModal
        open={versusModalOpen}
        onClose={() => {
          speechService.stop();
          setVersusModalOpen(false);
        }}
        onPick={handleVersusModalPick}
        selectedTime={selectedTime}
        modeLabel={selectedMode === "voice" ? "Voice Chess" : "Classic Chess"}
      />

      {/* Voice Commands Modal */}
      <VoiceCommandsModal
        open={commandsModalOpen}
        onClose={() => {
          speechService.stop();
          setCommandsModalOpen(false);
        }}
      />
    </div>
  );
};

export default HomePage;
