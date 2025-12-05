// import React, { useEffect, useState } from "react";
// import speechService from "../utils/speechService";
// import "./GameRules.css";

// interface GameRulesProps {
//   gameMode: "voice" | "classic";
//   onClose?: () => void;
// }

// const CHESS_RULES_TEXT = {
//   voice:
//     "Voice Chess — Say a square to select a piece (e.g., e2), then say destination (e.g., e4). Standard chess rules apply. Good luck!",
//   classic:
//     "Classic Chess — Click a piece, then click the destination square. Standard chess rules apply. Good luck!",
// };

// const GameRules: React.FC<GameRulesProps> = ({ gameMode, onClose }) => {
//   const [isNarrating, setIsNarrating] = useState(false);
//   const [showRulesText, setShowRulesText] = useState(true);

//   useEffect(() => {
//     const autoPlay = async () => {
//       if (!speechService.isSupportedBrowser()) return;
//       setShowRulesText(false);
//       setIsNarrating(true);
//       try {
//         await speechService.speak({
//           text: CHESS_RULES_TEXT[gameMode],
//           lang: "en-US",
//           rate: 1,
//           onStart: () => {},
//           onEnd: () => {
//             setIsNarrating(false);
//             setShowRulesText(true);
//           },
//           onError: () => {
//             setIsNarrating(false);
//             setShowRulesText(true);
//           },
//         });
//       } catch (e) {
//         console.warn("Rules narration failed:", e);
//         setIsNarrating(false);
//         setShowRulesText(true);
//       }
//     };

//     autoPlay();
//     // run once on mount
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   const playNarration = async () => {
//     if (!speechService.isSupportedBrowser()) return;
//     setIsNarrating(true);
//     setShowRulesText(false);
//     try {
//       await speechService.speak({
//         text: CHESS_RULES_TEXT[gameMode],
//         lang: "en-US",
//         rate: 1,
//         onEnd: () => {
//           setIsNarrating(false);
//           setShowRulesText(true);
//         },
//         onError: () => {
//           setIsNarrating(false);
//           setShowRulesText(true);
//         },
//       });
//     } catch (e) {
//       console.warn("Playback failed:", e);
//       setIsNarrating(false);
//       setShowRulesText(true);
//     }
//   };

//   const stopNarration = () => {
//     speechService.stop();
//     setIsNarrating(false);
//     setShowRulesText(true);
//   };

//   return (
//     <div className="game-rules-overlay">
//       <div className="game-rules-modal">
//         <div className="rules-header">
//           <h2>
//             ♟️ Chess Rules -{" "}
//             {gameMode === "voice" ? "Voice Mode" : "Classic Mode"}
//           </h2>
//           <button
//             className="close-btn"
//             onClick={onClose}
//             aria-label="Close rules"
//           >
//             ✕
//           </button>
//         </div>

//         {isNarrating && (
//           <div className="narration-indicator">
//             <span className="pulse">🔊 Narrating...</span>
//           </div>
//         )}

//         {showRulesText && (
//           <div className="rules-content">
//             <p>{CHESS_RULES_TEXT[gameMode]}</p>
//           </div>
//         )}

//         <div className="rules-actions">
//           {speechService.isSupportedBrowser() && (
//             <>
//               {isNarrating ? (
//                 <button
//                   className="btn btn-secondary"
//                   onClick={stopNarration}
//                   aria-label="Stop narration"
//                 >
//                   ⏹ Stop Narration
//                 </button>
//               ) : (
//                 <button
//                   className="btn btn-secondary"
//                   onClick={playNarration}
//                   aria-label="Play rules narration"
//                 >
//                   🔊 Replay Narration
//                 </button>
//               )}
//             </>
//           )}
//           <button
//             className="btn btn-primary"
//             onClick={onClose}
//             aria-label="Start game"
//           >
//             Start Game
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// };

// export default GameRules;
