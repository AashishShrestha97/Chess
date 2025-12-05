// src/utils/globalVoiceParser.ts
// Enhanced Global Voice Command Parser with comprehensive accent support and improved chess parsing

import { Chess } from "chess.js";

export interface ParsedCommand {
  intent: string;
  confidence: number;
  originalText: string;
  metadata?: any;
}

export class GlobalVoiceParser {
  // Comprehensive phonetic mappings for South Asian accents
  private static phoneticMap: { [key: string]: string } = {
    // Knight variations (most extensive - this is the most problematic piece)
    night: "knight", nite: "knight", bite: "knight", naight: "knight",
    nait: "knight", knite: "knight", neit: "knight", nyte: "knight",
    naitt: "knight", nayt: "knight", nitte: "knight", naait: "knight",
    knit: "knight", nit: "knight", nate: "knight", neet: "knight",
    neett: "knight", nnait: "knight", nayte: "knight", naeit: "knight",
    niet: "knight", nigt: "knight", kn: "knight", naigt: "knight",
    
    // Queen variations
    queen: "queen", kween: "queen", quin: "queen", kwin: "queen",
    quine: "queen", qeen: "queen", kiwin: "queen", qween: "queen",
    kwon: "queen", quon: "queen", kuen: "queen",
    
    // King variations
    king: "king", kink: "king", keen: "king", keeng: "king",
    keng: "king", kang: "king",
    
    // Rook variations
    rook: "rook", rock: "rook", brook: "rook", ruk: "rook",
    ruke: "rook", rok: "rook", ruck: "rook", roak: "rook",
    
    // Bishop variations
    bishop: "bishop", bisop: "bishop", biship: "bishop", bishap: "bishop",
    bisap: "bishop", bish: "bishop", bishup: "bishop", bisup: "bishop",
    
    // Pawn variations
    pawn: "pawn", pond: "pawn", paun: "pawn", pwn: "pawn",
    pon: "pawn", pown: "pawn", paan: "pawn", pan: "pawn",
    
    // Action variations
    take: "takes", takes: "takes", tek: "takes", teyk: "takes",
    capture: "takes", captures: "takes", catch: "takes", ketch: "takes",
    
    // Direction variations
    too: "to", two: "to", tu: "to", toh: "to", tuh: "to",
    
    // Time control variations
    bullet: "bullet", bulit: "bullet", bullit: "bullet", bulet: "bullet",
    blitz: "blitz", blits: "blitz", bleetz: "blitz", blets: "blitz",
    rapid: "rapid", repid: "rapid", rapeed: "rapid", raped: "rapid",
    classical: "classical", classicle: "classical", klasikal: "classical",
    classic: "classical", classik: "classical",
    
    // Chess terms
    castle: "castle", kastle: "castle", casel: "castle", kasel: "castle",
    kingside: "kingside", kingsaid: "kingside", king_side: "kingside",
    queenside: "queenside", queensaid: "queenside", queen_side: "queenside",
    
    // Common words
    play: "play", plai: "play", pley: "play", plei: "play",
    start: "start", strat: "start", sart: "start", sturt: "start",
    random: "random", rendom: "random", randum: "random", rondom: "random",
    friend: "friend", frend: "friend", frand: "friend", frient: "friend",
    friends: "friends", frends: "friends", frands: "friends",
    
    // Plus variations (for time controls)
    plus: "plus", plas: "plus", plush: "plus", pls: "plus",
  };

  // Comprehensive number word variations with Nepali/Hindi numbers
  private static numberMap: { [key: string]: string } = {
    // English numbers with phonetic variations
    zero: "0", jero: "0", sero: "0", ziyo: "0",
    one: "1", won: "1", wan: "1", ek: "1", aek: "1", ekh: "1",
    two: "2", too: "2", tu: "2", do: "2", dui: "2", doo: "2",
    three: "3", tree: "3", thri: "3", teen: "3", tin: "3", theen: "3",
    four: "4", for: "4", phor: "4", char: "4", chaar: "4", fore: "4", foor: "4",
    five: "5", phive: "5", fibe: "5", panch: "5", paanch: "5", fife: "5",
    six: "6", sicks: "6", sekh: "6", chha: "6", siks: "6", sikhs: "6",
    seven: "7", seben: "7", saat: "7", sewen: "7", sewn: "7",
    eight: "8", ate: "8", ait: "8", aat: "8", aath: "8", eit: "8",
    nine: "9", nain: "9", naw: "9", no: "9", nau: "9", naun: "9",
    
    // Teens
    ten: "10", tan: "10", das: "10", den: "10",
    eleven: "11", ileven: "11", eghara: "11",
    twelve: "12", twelv: "12", twelf: "12", bahra: "12",
    thirteen: "13", therteen: "13", tera: "13", tehra: "13",
    fourteen: "14", forteen: "14", chaudha: "14",
    fifteen: "15", phifteen: "15", pandrah: "15", pandraa: "15",
    sixteen: "16", siksten: "16", solha: "16",
    seventeen: "17", sebenten: "17", satra: "17",
    eighteen: "18", eightteen: "18", athara: "18", athaara: "18",
    nineteen: "19", nainteen: "19", unnis: "19", unnais: "19",
    
    // Tens
    twenty: "20", twanty: "20", bis: "20", bees: "20", twenti: "20",
    thirty: "30", thurty: "30", tees: "30", tiis: "30", thirti: "30",
    forty: "40", forti: "40", chaalis: "40", chalis: "40",
    fifty: "50", fifti: "50", pachas: "50", pachhas: "50",
    sixty: "60", siksti: "60", saath: "60", sath: "60", sikhsti: "60",
    seventy: "70", sebenti: "70", sattar: "70", satter: "70",
    eighty: "80", eiti: "80", assi: "80", aasi: "80",
    ninety: "90", nainti: "90", nabbe: "90", naabey: "90",
    
    // Hundreds (for classical time controls)
    hundred: "100", hundrad: "100", sau: "100", sou: "100",
    
    // Common time control numbers
    "one twenty": "120", "one hundred twenty": "120",
  };

  // Enhanced file/rank phonetic mappings
  private static fileMap: { [key: string]: string } = {
    // Files (a-h) with phonetic variations
    a: "a", ay: "a", eh: "a", aah: "a",
    b: "b", be: "b", bee: "b", bi: "b",
    c: "c", see: "c", sea: "c", si: "c", ce: "c",
    d: "d", de: "d", dee: "d", di: "d",
    e: "e", ee: "e", ea: "e", ii: "e",
    f: "f", ef: "f", eff: "f", aff: "f",
    g: "g", ge: "g", gee: "g", ji: "g",
    h: "h", aitch: "h", ache: "h", eich: "h",
  };

  private static rankMap: { [key: string]: string } = {
    // Ranks (1-8) with extensive phonetic variations
    one: "1", won: "1", wan: "1", ek: "1", aek: "1",
    two: "2", too: "2", tu: "2", do: "2", dui: "2",
    three: "3", tree: "3", thri: "3", teen: "3", tin: "3",
    four: "4", for: "4", phor: "4", char: "4", fore: "4",
    five: "5", phive: "5", fibe: "5", panch: "5", fife: "5",
    six: "6", sicks: "6", sekh: "6", chha: "6", siks: "6",
    seven: "7", seben: "7", saat: "7", sewen: "7",
    eight: "8", ate: "8", ait: "8", aat: "8", eit: "8",
    
    // Direct digit recognition
    "1": "1", "2": "2", "3": "3", "4": "4",
    "5": "5", "6": "6", "7": "7", "8": "8",
  };

  // Command patterns for navigation and game control
  private static commandPatterns: { [intent: string]: string[] } = {
    // Voice control
    VOICE_ON: [
      "voice on", "enable voice", "start voice", "turn on voice",
      "activate voice", "voice active", "boys on", "wake up",
      "voice enable", "enable boys",
    ],
    VOICE_OFF: [
      "voice off", "disable voice", "stop voice", "turn off voice",
      "deactivate voice", "voice inactive", "boys off", "sleep",
      "voice disable", "disable boys",
    ],
    VOICE_STOP: [
      "stop", "stop listening", "stop talking", "quiet", "shush",
      "stop that", "stop it", "enough", "stop speaking",
      "be quiet", "silence", "stop now",
    ],
    VOICE_REPEAT: [
      "repeat", "repeat that", "say again", "what", "pardon",
      "say that again", "repeat again", "one more time",
      "say it again", "repeat please",
    ],

    // Game mode selection
    START_VOICE_CHESS: [
      "voice chess", "start voice chess", "play voice chess",
      "voice game", "start voice", "play voice", "boys chess",
      "voice mode", "play with voice", "begin voice chess",
      "voice play", "start voice game",
    ],
    START_CLASSIC_CHESS: [
      "classic chess", "start classic chess", "play classic chess",
      "classic game", "start classic", "play classic", "normal chess",
      "regular chess", "standard chess", "traditional chess",
    ],

    // Navigation
    GO_HOME: [
      "go home", "home", "main menu", "go to home", "home page",
      "back to home", "return home", "menu",
    ],
    GO_BACK: [
      "go back", "back", "return", "previous", "go to previous",
      "back page", "previous page",
    ],
  };

  /**
   * Normalize text with phonetic replacements for better accent handling
   */
  private static normalizeText(text: string): string {
    let normalized = text.toLowerCase().trim();

    // Apply phonetic mappings
    const words = normalized.split(/\s+/);
    const normalizedWords = words.map(word => {
      // Remove punctuation from word for matching
      const cleanWord = word.replace(/[.,!?;:]/g, '');
      return this.phoneticMap[cleanWord] || word;
    });
    normalized = normalizedWords.join(' ');

    // Replace number words with digits
    Object.entries(this.numberMap).forEach(([word, digit]) => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      normalized = normalized.replace(regex, digit);
    });

    return normalized;
  }

  /**
   * Parse navigation commands
   */
  static parseNavigationCommand(transcript: string): ParsedCommand | null {
    const normalized = this.normalizeText(transcript);

    for (const [intent, patterns] of Object.entries(this.commandPatterns)) {
      for (const pattern of patterns) {
        if (normalized.includes(pattern)) {
          return {
            intent,
            confidence: 1.0,
            originalText: transcript,
          };
        }
      }
    }

    return null;
  }

  /**
   * Enhanced chess move parser with better piece detection and square parsing
   */
  static parseChessMove(transcript: string, chess: Chess): string | null {
    const legalMoves = chess.moves({ verbose: true });
    if (legalMoves.length === 0) {
      return null;
    }

    // Normalize the text
    let processed = this.normalizeText(transcript);
    
    console.log("🔍 Original:", transcript);
    console.log("🔍 Normalized:", processed);

    // Piece name mapping
    const pieceMap: { [key: string]: string } = {
      knight: "N", bishop: "B", rook: "R", queen: "Q", king: "K", pawn: "P"
    };

    // Create regex-friendly piece name list
    const pieceNames = Object.keys(pieceMap).join('|');

    // 1. CASTLING (highest priority)
    if (/\b(castle|castles|castling)\b/i.test(processed)) {
      if (/\b(king|kings|kingside|king.?side|short)\b/i.test(processed)) {
        const move = legalMoves.find(m => m.san === "O-O");
        if (move) {
          console.log("✅ Kingside castling");
          return move.san;
        }
      }
      if (/\b(queen|queens|queenside|queen.?side|long)\b/i.test(processed)) {
        const move = legalMoves.find(m => m.san === "O-O-O");
        if (move) {
          console.log("✅ Queenside castling");
          return move.san;
        }
      }
    }

    // Helper function to extract square from text
    const extractSquare = (text: string, afterPattern?: string): string | null => {
      let searchText = text;
      
      if (afterPattern) {
        const index = text.indexOf(afterPattern);
        if (index !== -1) {
          searchText = text.substring(index + afterPattern.length);
        }
      }

      // Look for file and rank pattern with various separators
      const squarePattern = /\b([a-h]|ay|eh|be|see|de|ee|ef|ge|aitch)\s*[-_]?\s*([1-8]|one|two|three|four|five|six|seven|eight|ek|do|teen|char|panch|chha|saat|aat)\b/i;
      const match = searchText.match(squarePattern);
      
      if (match) {
        let file = match[1].toLowerCase();
        let rank = match[2].toLowerCase();
        
        file = this.fileMap[file] || file;
        rank = this.rankMap[rank] || rank;
        
        if (/[a-h]/.test(file) && /[1-8]/.test(rank)) {
          return file + rank;
        }
      }
      
      return null;
    };

    // 2. SIMPLE SQUARE MOVE (e.g., "e4", "d4", "c3")
    // This is the most common - try first
    const simpleSquare = extractSquare(processed);
    if (simpleSquare) {
      // Check if there's a piece mentioned
      let hasPieceMention = false;
      for (const pieceName of Object.keys(pieceMap)) {
        if (processed.includes(pieceName)) {
          hasPieceMention = true;
          break;
        }
      }
      
      // If no piece mentioned, try pawn move first
      if (!hasPieceMention) {
        const pawnCandidates = legalMoves.filter(m => 
          m.to === simpleSquare && m.piece === "p"
        );
        
        if (pawnCandidates.length === 1) {
          console.log("✅ Simple pawn move:", pawnCandidates[0].san);
          return pawnCandidates[0].san;
        }
        
        // Try any piece to that square
        const anyCandidates = legalMoves.filter(m => m.to === simpleSquare);
        if (anyCandidates.length === 1) {
          console.log("✅ Single move to square:", anyCandidates[0].san);
          return anyCandidates[0].san;
        }
      }
    }

    // 3. PIECE TO SQUARE (e.g., "knight to f3", "bishop to c4")
    // IMPROVED: Better pattern matching for piece moves
    const pieceToPattern = new RegExp(
      `\\b(${pieceNames})\\s+(?:to|at|on|too|tu|toh)?\\s*([a-h]|ay|eh|be|see|de|ee|ef|ge|aitch)\\s*[-_]?\\s*([1-8]|one|two|three|four|five|six|seven|eight|ek|do|teen|char|panch|chha|saat|aat)\\b`,
      'i'
    );
    
    const pieceToMatch = processed.match(pieceToPattern);
    if (pieceToMatch) {
      const pieceName = pieceToMatch[1].toLowerCase();
      let file = pieceToMatch[2].toLowerCase();
      let rank = pieceToMatch[3].toLowerCase();
      
      file = this.fileMap[file] || file;
      rank = this.rankMap[rank] || rank;
      
      const square = file + rank;
      const piece = pieceMap[pieceName];
      
      console.log(`🎯 Detected: ${pieceName} to ${square}`);
      
      // Find moves matching this piece and destination
      let candidates = legalMoves.filter(m => m.to === square);
      
      if (piece) {
        candidates = candidates.filter(m => m.piece.toUpperCase() === piece);
      }
      
      if (candidates.length === 1) {
        console.log("✅ Piece move:", candidates[0].san);
        return candidates[0].san;
      }
      
      if (candidates.length > 1) {
        // Multiple candidates - try to disambiguate
        console.log(`⚠️ Multiple candidates for ${pieceName} to ${square}:`, 
          candidates.map(m => m.san).join(", "));
        
        // If the original text has "from" with a square, use that
        const fromSquareMatch = processed.match(/from\s+([a-h][1-8])/i);
        if (fromSquareMatch) {
          const fromSquare = fromSquareMatch[1];
          const specific = candidates.find(m => m.from === fromSquare);
          if (specific) {
            console.log("✅ Disambiguated move:", specific.san);
            return specific.san;
          }
        }
        
        // Otherwise return first candidate
        console.log("✅ First candidate:", candidates[0].san);
        return candidates[0].san;
      }
    }

    // 4. PIECE TAKES SQUARE (e.g., "knight takes e5", "bishop captures d4")
    const pieceTakesPattern = new RegExp(
      `\\b(${pieceNames})\\s*(?:takes?|captures?|x|tek|teyk|catch|ketch)\\s*([a-h]|ay|eh|be|see|de|ee|ef|ge|aitch)\\s*[-_]?\\s*([1-8]|one|two|three|four|five|six|seven|eight|ek|do|teen|char|panch|chha|saat|aat)\\b`,
      'i'
    );
    
    const pieceTakesMatch = processed.match(pieceTakesPattern);
    if (pieceTakesMatch) {
      const pieceName = pieceTakesMatch[1].toLowerCase();
      let file = pieceTakesMatch[2].toLowerCase();
      let rank = pieceTakesMatch[3].toLowerCase();
      
      file = this.fileMap[file] || file;
      rank = this.rankMap[rank] || rank;
      
      const square = file + rank;
      const piece = pieceMap[pieceName];
      
      console.log(`🎯 Detected: ${pieceName} takes ${square}`);
      
      let candidates = legalMoves.filter(m => m.to === square && m.captured);
      
      if (piece) {
        candidates = candidates.filter(m => m.piece.toUpperCase() === piece);
      }
      
      if (candidates.length === 1) {
        console.log("✅ Capture move:", candidates[0].san);
        return candidates[0].san;
      }
      
      if (candidates.length > 0) {
        console.log("✅ First capture:", candidates[0].san);
        return candidates[0].san;
      }
    }

    // 5. PAWN TAKES (e.g., "e takes d5", "pawn takes e5")
    const pawnTakesPattern = /\b([a-h]|ay|eh|be|see|de|ee|ef|ge|aitch)\s*(?:takes?|captures?|x|tek|teyk|catch)\s*([a-h]|ay|eh|be|see|de|ee|ef|ge|aitch)\s*[-_]?\s*([1-8]|one|two|three|four|five|six|seven|eight|ek|do|teen|char|panch|chha|saat|aat)\b/i;
    
    const pawnTakesMatch = processed.match(pawnTakesPattern);
    if (pawnTakesMatch) {
      let fromFile = pawnTakesMatch[1].toLowerCase();
      let toFile = pawnTakesMatch[2].toLowerCase();
      let toRank = pawnTakesMatch[3].toLowerCase();
      
      fromFile = this.fileMap[fromFile] || fromFile;
      toFile = this.fileMap[toFile] || toFile;
      toRank = this.rankMap[toRank] || toRank;
      
      const toSquare = toFile + toRank;
      
      console.log(`🎯 Detected: ${fromFile} pawn takes ${toSquare}`);
      
      const candidates = legalMoves.filter(m => 
        m.to === toSquare && 
        m.captured &&
        m.piece === "p" &&
        m.from[0] === fromFile
      );
      
      if (candidates.length > 0) {
        console.log("✅ Pawn capture:", candidates[0].san);
        return candidates[0].san;
      }
    }

    // 6. PROMOTION (e.g., "pawn to e8 queen", "e8 queen")
    const promotionPattern = /\b([a-h])?\s*(?:[27])?\s*(?:to|on)?\\s*([a-h])\s*[-_]?\s*([18])\s*(?:promote|queen|rook|bishop|knight|kween|rok|bishap|night)/i;
    
    const promotionMatch = processed.match(promotionPattern);
    if (promotionMatch) {
      let toFile = promotionMatch[2].toLowerCase();
      let toRank = promotionMatch[3].toLowerCase();
      
      toFile = this.fileMap[toFile] || toFile;
      toRank = this.rankMap[toRank] || toRank;
      
      const toSquare = toFile + toRank;
      
      let promoPiece = 'q';
      if (/rook|rok/.test(processed)) promoPiece = 'r';
      if (/bishop|bishap/.test(processed)) promoPiece = 'b';
      if (/knight|night/.test(processed)) promoPiece = 'n';
      
      console.log(`🎯 Detected: promotion to ${toSquare} = ${promoPiece}`);
      
      const candidates = legalMoves.filter(m => 
        m.to === toSquare && 
        m.promotion === promoPiece
      );
      
      if (candidates.length > 0) {
        console.log("✅ Promotion:", candidates[0].san);
        return candidates[0].san;
      }
    }

    // 7. DISAMBIGUATION (e.g., "knight from g1 to f3", "rook a1 to a8")
    const disambigPattern = new RegExp(
      `\\b(${pieceNames})\\s*(?:from|at)?\\s*([a-h][1-8])\\s*(?:to|on)?\\s*([a-h][1-8])\\b`,
      'i'
    );
    
    const disambigMatch = processed.match(disambigPattern);
    if (disambigMatch) {
      const pieceName = disambigMatch[1].toLowerCase();
      const from = disambigMatch[2];
      const to = disambigMatch[3];
      const piece = pieceMap[pieceName];
      
      console.log(`🎯 Detected: ${pieceName} from ${from} to ${to}`);
      
      let candidates = legalMoves.filter(m => m.from === from && m.to === to);
      
      if (piece) {
        candidates = candidates.filter(m => m.piece.toUpperCase() === piece);
      }
      
      if (candidates.length > 0) {
        console.log("✅ Disambiguated:", candidates[0].san);
        return candidates[0].san;
      }
    }

    // 8. TRY DIRECT SAN MATCH
    const compactText = processed.replace(/\s+/g, '');
    for (const move of legalMoves) {
      const compactSan = move.san.replace(/[+#]/g, '').toLowerCase();
      if (compactText.includes(compactSan)) {
        console.log("✅ Direct SAN match:", move.san);
        return move.san;
      }
    }

    // 9. FALLBACK: Any square mentioned
    const squarePattern = /\b([a-h])([1-8])\b/gi;
    const matches = [...processed.matchAll(squarePattern)];
    
    for (const match of matches) {
      const square = match[0];
      const candidates = legalMoves.filter(m => m.to === square);
      
      if (candidates.length === 1) {
        console.log("✅ Fallback match:", candidates[0].san);
        return candidates[0].san;
      }
    }

    console.log("❌ No valid move found for:", transcript);
    console.log("💡 Legal moves:", legalMoves.map(m => m.san).slice(0, 10).join(", "));
    return null;
  }

  /**
   * Main parse function
   */
  static parse(transcript: string, chess?: Chess): ParsedCommand | null {
    const navCommand = this.parseNavigationCommand(transcript);
    if (navCommand) {
      return navCommand;
    }

    if (chess) {
      const move = this.parseChessMove(transcript, chess);
      if (move) {
        return {
          intent: "CHESS_MOVE",
          confidence: 1.0,
          originalText: transcript,
          metadata: { move },
        };
      }
    }

    return null;
  }
}

export default GlobalVoiceParser;