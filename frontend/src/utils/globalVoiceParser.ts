// src/utils/globalVoiceParser.ts
// Ultra-Comprehensive Global Voice Command Parser with exhaustive pattern coverage

import { Chess } from "chess.js";

export interface ParsedCommand {
  intent: string;
  confidence: number;
  originalText: string;
  metadata?: any;
}

export class GlobalVoiceParser {
  // ============================================================================
  // PHONETIC MAPPINGS - Comprehensive accent and pronunciation variations
  // ============================================================================
  
  private static phoneticMap: { [key: string]: string } = {
    // KNIGHT variations (most problematic piece - exhaustive list)
    night: "knight", nite: "knight", bite: "knight", naight: "knight",
    nait: "knight", knite: "knight", neit: "knight", nyte: "knight",
    naitt: "knight", nayt: "knight", nitte: "knight", naait: "knight",
    knit: "knight", nit: "knight", nate: "knight", neet: "knight",
    neett: "knight", nnait: "knight", nayte: "knight", naeit: "knight",
    niet: "knight", nigt: "knight", kn: "knight", naigt: "knight",
    naiyte: "knight", nght: "knight", nightt: "knight", knght: "knight",
    nyt: "knight", neight: "knight", knyght: "knight", nyght: "knight",
    
    // QUEEN variations
    queen: "queen", kween: "queen", quin: "queen", kwin: "queen",
    quine: "queen", qeen: "queen", kiwin: "queen", qween: "queen",
    kwon: "queen", quon: "queen", kuen: "queen", qwin: "queen",
    qewin: "queen", kwean: "queen", quean: "queen", kwen: "queen",
    
    // KING variations
    king: "king", kink: "king", keen: "king", keeng: "king",
    keng: "king", kang: "king", kyng: "king", kiing: "king",
    
    // ROOK variations
    rook: "rook", rock: "rook", brook: "rook", ruk: "rook",
    ruke: "rook", rok: "rook", ruck: "rook", roak: "rook",
    rouk: "rook", rouuk: "rook", roc: "rook", ruuk: "rook",
    
    // BISHOP variations
    bishop: "bishop", bisop: "bishop", biship: "bishop", bishap: "bishop",
    bisap: "bishop", bish: "bishop", bishup: "bishop", bisup: "bishop",
    bishob: "bishop", bishot: "bishop", bishub: "bishop", bishep: "bishop",
    
    // PAWN variations
    pawn: "pawn", pond: "pawn", paun: "pawn", pwn: "pawn",
    pon: "pawn", pown: "pawn", paan: "pawn", pan: "pawn",
    porn: "pawn", parn: "pawn", pone: "pawn",
    
    // ACTION variations (takes/captures)
    take: "takes", takes: "takes", tek: "takes", teyk: "takes",
    capture: "takes", captures: "takes", catch: "takes", ketch: "takes",
    captcha: "takes", catcher: "takes", teks: "takes", teyks: "takes",
    taking: "takes", capturing: "takes", grab: "takes", grabs: "takes",
    
    // DIRECTION variations (to)
    too: "to", two: "to", tu: "to", toh: "to", tuh: "to",
    toward: "to", towards: "to", into: "to", onto: "to",
    
    // TIME CONTROL variations
    bullet: "bullet", bulit: "bullet", bullit: "bullet", bulet: "bullet",
    bullett: "bullet", bullitt: "bullet", bulent: "bullet",
    
    blitz: "blitz", blits: "blitz", bleetz: "blitz", blets: "blitz",
    blitzs: "blitz", blitx: "blitz", bliz: "blitz",
    
    rapid: "rapid", repid: "rapid", rapeed: "rapid", raped: "rapid",
    rappid: "rapid", rapyd: "rapid", repeed: "rapid",
    
    classical: "classical", classicle: "classical", klasikal: "classical",
    classic: "classical", classik: "classical", clasical: "classical",
    klassical: "classical", classicul: "classical",
    
    // CHESS TERMS
    castle: "castle", kastle: "castle", casel: "castle", kasel: "castle",
    castling: "castle", castles: "castle", kassle: "castle",
    
    kingside: "kingside", kingsaid: "kingside", king_side: "kingside",
    kingsite: "kingside", kingsyde: "kingside", short: "kingside",
    
    queenside: "queenside", queensaid: "queenside", queen_side: "queenside",
    queensite: "queenside", queensyde: "queenside", long: "queenside",
    
    // COMMON WORDS
    play: "play", plai: "play", pley: "play", plei: "play",
    playing: "play", playe: "play",
    
    start: "start", strat: "start", sart: "start", sturt: "start",
    starting: "start", startt: "start",
    
    random: "random", rendom: "random", randum: "random", rondom: "random",
    randome: "random", randem: "random",
    
    friend: "friend", frend: "friend", frand: "friend", frient: "friend",
    friends: "friends", frends: "friends", frands: "friends",
    
    // PLUS/AND variations (for time controls)
    plus: "plus", plas: "plus", plush: "plus", pls: "plus",
    and: "plus", n: "plus", nd: "plus",
    
    // NUMBER WORD CONNECTORS
    minute: "minute", minutes: "minute", min: "minute", mins: "minute",
    minit: "minute", minits: "minute", minut: "minute",
    
    second: "second", seconds: "second", sec: "second", secs: "second",
    secund: "second", sekond: "second",
    
    hour: "hour", hours: "hour", hr: "hour", hrs: "hour",
    our: "hour", ower: "hour",
  };

  // ============================================================================
  // NUMBER MAPPINGS - Comprehensive number word variations
  // ============================================================================
  
  private static numberMap: { [key: string]: string } = {
    // BASIC DIGITS (0-9) with phonetic variations
    zero: "0", jero: "0", sero: "0", ziyo: "0", ziro: "0", xero: "0",
    
    one: "1", won: "1", wan: "1", ek: "1", aek: "1", ekh: "1", wun: "1",
    
    two: "2", too: "2", tu: "2", do: "2", dui: "2", doo: "2", tew: "2",
    to: "2", tow: "2",
    
    three: "3", tree: "3", thri: "3", teen: "3", tin: "3", theen: "3",
    thre: "3", trhee: "3", thrie: "3",
    
    four: "4", for: "4", phor: "4", char: "4", chaar: "4", fore: "4",
    foor: "4", foar: "4", foru: "4",
    
    five: "5", phive: "5", fibe: "5", panch: "5", paanch: "5", fife: "5",
    fyve: "5", fiv: "5",
    
    six: "6", sicks: "6", sekh: "6", chha: "6", siks: "6", sikhs: "6",
    sics: "6", seex: "6", seeks: "6",
    
    seven: "7", seben: "7", saat: "7", sewen: "7", sewn: "7", sevn: "7",
    sevan: "7",
    
    eight: "8", ate: "8", ait: "8", aat: "8", aath: "8", eit: "8",
    eyt: "8", eate: "8",
    
    nine: "9", nain: "9", naw: "9", no: "9", nau: "9", naun: "9",
    nyne: "9", nien: "9",
    
    // TEENS (10-19)
    ten: "10", tan: "10", das: "10", den: "10", tenn: "10",
    
    eleven: "11", ileven: "11", eghara: "11", elevan: "11", elevn: "11",
    
    twelve: "12", twelv: "12", twelf: "12", bahra: "12", twelwe: "12",
    
    thirteen: "13", therteen: "13", tera: "13", tehra: "13", thirten: "13",
    thirtean: "13",
    
    fourteen: "14", forteen: "14", chaudha: "14", fourten: "14", fortean: "14",
    
    fifteen: "15", phifteen: "15", pandrah: "15", pandraa: "15", fiften: "15",
    fiftean: "15",
    
    sixteen: "16", siksten: "16", solha: "16", sixten: "16", sixtean: "16",
    
    seventeen: "17", sebenten: "17", satra: "17", seventen: "17", seventean: "17",
    
    eighteen: "18", eightteen: "18", athara: "18", athaara: "18", eighten: "18",
    eightean: "18",
    
    nineteen: "19", nainteen: "19", unnis: "19", unnais: "19", ninten: "19",
    ninetean: "19",
    
    // TENS (20-90)
    twenty: "20", twanty: "20", bis: "20", bees: "20", twenti: "20",
    twentie: "20", twentee: "20",
    
    "twenty one": "21", "twenty-one": "21", "twenty1": "21", "twentyone": "21",
    "twenty two": "22", "twenty-two": "22", "twenty2": "22", "twentytwo": "22",
    "twenty three": "23", "twenty-three": "23", "twenty3": "23", "twentythree": "23",
    "twenty four": "24", "twenty-four": "24", "twenty4": "24", "twentyfour": "24",
    "twenty five": "25", "twenty-five": "25", "twenty5": "25", "twentyfive": "25",
    "twenty six": "26", "twenty-six": "26", "twenty6": "26", "twentysix": "26",
    "twenty seven": "27", "twenty-seven": "27", "twenty7": "27", "twentyseven": "27",
    "twenty eight": "28", "twenty-eight": "28", "twenty8": "28", "twentyeight": "28",
    "twenty nine": "29", "twenty-nine": "29", "twenty9": "29", "twentynine": "29",
    
    thirty: "30", thurty: "30", tees: "30", tiis: "30", thirti: "30",
    thirtie: "30", thirtee: "30",
    
    "thirty one": "31", "thirty-one": "31", "thirtyone": "31",
    "thirty two": "32", "thirty-two": "32", "thirtytwo": "32",
    
    forty: "40", forti: "40", chaalis: "40", chalis: "40", fortie: "40",
    
    fifty: "50", fifti: "50", pachas: "50", pachhas: "50", fiftie: "50",
    
    sixty: "60", siksti: "60", saath: "60", sath: "60", sikhsti: "60",
    sixtie: "60",
    
    seventy: "70", sebenti: "70", sattar: "70", satter: "70", seventie: "70",
    
    eighty: "80", eiti: "80", assi: "80", aasi: "80", eightie: "80",
    
    ninety: "90", nainti: "90", nabbe: "90", naabey: "90", ninetie: "90",
    nainty: "90",
    
    // HUNDREDS
    hundred: "100", hundrad: "100", sau: "100", sou: "100", hunderd: "100",
    "one hundred": "100", "1 hundred": "100",
    
    "one hundred twenty": "120", "120": "120", "hundred twenty": "120",
    "one twenty": "120", "hundred and twenty": "120",
    
    // COMMON TIME CONTROL NUMBERS (in words)
    half: "0.5", "half a": "0.5", "point five": "0.5", "zero point five": "0.5",
  };

  // ============================================================================
  // FILE AND RANK MAPPINGS - Chess square notation
  // ============================================================================
  
  private static fileMap: { [key: string]: string } = {
    // FILES (a-h) with extensive phonetic variations
    a: "a", ay: "a", eh: "a", aah: "a", aye: "a", ei: "a",
    
    b: "b", be: "b", bee: "b", bi: "b", bea: "b", bii: "b",
    
    c: "c", see: "c", sea: "c", si: "c", ce: "c", cee: "c",
    cii: "c", sie: "c",
    
    d: "d", de: "d", dee: "d", di: "d", dii: "d", dea: "d",
    
    e: "e", ee: "e", ea: "e", ii: "e", eee: "e", ey: "e",
    
    f: "f", ef: "f", eff: "f", aff: "f", eph: "f", efe: "f",
    
    g: "g", ge: "g", gee: "g", ji: "g", gii: "g", jee: "g",
    
    h: "h", aitch: "h", ache: "h", eich: "h", eight: "h", 
    aich: "h", hh: "h", haitch: "h",
  };

  private static rankMap: { [key: string]: string } = {
    // RANKS (1-8) with extensive phonetic variations
    one: "1", won: "1", wan: "1", ek: "1", aek: "1", wun: "1",
    
    two: "2", too: "2", tu: "2", do: "2", dui: "2", tew: "2",
    
    three: "3", tree: "3", thri: "3", teen: "3", tin: "3", thre: "3",
    
    four: "4", for: "4", phor: "4", char: "4", fore: "4", foor: "4",
    
    five: "5", phive: "5", fibe: "5", panch: "5", fife: "5", fyve: "5",
    
    six: "6", sicks: "6", sekh: "6", chha: "6", siks: "6", seeks: "6",
    
    seven: "7", seben: "7", saat: "7", sewen: "7", sevn: "7",
    
    eight: "8", ate: "8", ait: "8", aat: "8", eit: "8", eyt: "8",
    
    // Direct digit recognition
    "1": "1", "2": "2", "3": "3", "4": "4",
    "5": "5", "6": "6", "7": "7", "8": "8",
  };

  // ============================================================================
  // COMMAND PATTERNS - Comprehensive voice command library
  // ============================================================================
  
  private static commandPatterns: { [intent: string]: string[] } = {
    // ========== VOICE CONTROL ==========
    VOICE_ON: [
      "voice on", "enable voice", "start voice", "turn on voice",
      "activate voice", "voice active", "boys on", "wake up",
      "voice enable", "enable boys", "turn voice on", "voice start",
      "activate voice control", "enable voice control", "voice control on",
      "start listening", "listen", "start voice mode", "voice mode on",
    ],
    
    VOICE_OFF: [
      "voice off", "disable voice", "stop voice", "turn off voice",
      "deactivate voice", "voice inactive", "boys off", "sleep",
      "voice disable", "disable boys", "turn voice off", "voice stop",
      "deactivate voice control", "disable voice control", "voice control off",
      "stop listening", "dont listen", "voice mode off",
    ],
    
    VOICE_STOP: [
      "stop", "stop listening", "stop talking", "quiet", "shush",
      "stop that", "stop it", "enough", "stop speaking",
      "be quiet", "silence", "stop now", "halt", "cease",
      "stop voice", "pause", "pause listening",
    ],
    
    VOICE_REPEAT: [
      "repeat", "repeat that", "say again", "what", "pardon",
      "say that again", "repeat again", "one more time",
      "say it again", "repeat please", "come again", "sorry",
      "what did you say", "can you repeat", "repeat last",
    ],

    // ========== GAME MODE SELECTION ==========
    START_VOICE_CHESS: [
      "voice chess", "start voice chess", "play voice chess",
      "voice game", "start voice", "play voice", "boys chess",
      "voice mode", "play with voice", "begin voice chess",
      "voice play", "start voice game", "play voice this", 
      "please voice this", "voice chess game", "play chess with voice",
      "start voice controlled chess", "voice controlled game",
      "new voice game", "new voice chess", "voice chess mode",
    ],
    
    START_CLASSIC_CHESS: [
      "classic chess", "start classic chess", "play classic chess",
      "classic game", "start classic", "play classic", "normal chess",
      "regular chess", "standard chess", "traditional chess",
      "classic mode", "play normal chess", "standard game",
      "regular game", "normal game", "classic chess game",
      "traditional game", "standard mode",
    ],

    // ========== NAVIGATION ==========
    GO_HOME: [
      "go home", "home", "main menu", "go to home", "home page",
      "back to home", "return home", "menu", "go to main menu",
      "main screen", "home screen", "go back home", "take me home",
      "navigate home", "show home", "go to menu",
    ],
    
    GO_BACK: [
      "go back", "back", "return", "previous", "go to previous",
      "back page", "previous page", "go previous", "previous screen",
      "back screen", "navigate back", "return to previous",
      "go to back", "take me back",
    ],
    
    SHOW_COMMANDS: [
      "show commands", "help", "commands", "what can i say", "help me",
      "show me commands", "what commands", "command list", "show help",
      "instructions", "how to", "guide", "show all commands",
      "list commands", "available commands", "voice commands",
      "what are the commands", "command help", "show voice commands",
      "help with commands", "command reference",
    ],

    // ========== TIME CONTROL CATEGORIES ==========
    TIME_CONTROLS_BULLET: [
      "bullet", "show bullet", "bullet options", "bullet time",
      "bullet controls", "1 minute", "one minute", "bulet",
      "bullet games", "bullet time controls", "show bullet options",
      "bullet mode", "select bullet", "choose bullet",
      "go to bullet", "bullet settings",
    ],
    
    TIME_CONTROLS_BLITZ: [
      "blitz", "show blitz", "blitz options", "blitz time",
      "blitz controls", "3 minutes", "five minutes", "5 minutes",
      "blitz games", "blitz time controls", "show blitz options",
      "blitz mode", "select blitz", "choose blitz",
      "go to blitz", "blitz settings",
    ],
    
    TIME_CONTROLS_RAPID: [
      "rapid", "show rapid", "rapid options", "rapid time",
      "rapid controls", "10 minutes", "15 minutes", "rapeed",
      "rapid games", "rapid time controls", "show rapid options",
      "rapid mode", "select rapid", "choose rapid",
      "go to rapid", "rapid settings",
    ],
    
    TIME_CONTROLS_CLASSICAL: [
      "classical", "show classical", "classical options", "classical time",
      "classical controls", "1 hour", "60 minutes", "90 minutes", "classic",
      "classical games", "classical time controls", "show classical options",
      "classical mode", "select classical", "choose classical",
      "go to classical", "classical settings", "long game",
    ],

    // ========== BULLET TIME CONTROLS (1+0, 1+1, 2+0, 2+1, 30s) ==========
    SELECT_BULLET_1_0: [
      // Standard formats
      "1 plus 0", "1 and 0", "1 0", "bullet 1 0", "1 plus zero",
      "one plus zero", "one and zero", "1+0", "bullet one plus zero",
      
      // With "minute/minutes"
      "1 minute", "one minute", "1 minute 0 seconds", "one minute zero seconds",
      "1 minute no increment", "one minute no increment",
      
      // Spelled out
      "one plus zero", "one and zero", "one zero",
      
      // Natural language
      "bullet one minute", "play one minute", "one minute game",
      "select one minute", "choose one minute", "one minute bullet",
      
      // With "select/choose/play"
      "select 1 plus 0", "choose 1 plus 0", "play 1 plus 0",
      "select one plus zero", "choose one plus zero", "play one plus zero",
      
      // Casual
      "one min", "1 min", "bullet 1", "just one minute",
    ],
    
    SELECT_BULLET_1_1: [
      "1 plus 1", "1 and 1", "1 1", "bullet 1 1", "1 plus one",
      "one plus one", "one and one", "1+1", "bullet one plus one",
      
      "1 minute 1 second", "one minute one second", "1 minute plus 1 second",
      "one minute plus one second", "1 minute 1 second increment",
      
      "one plus one", "one and one", "one one",
      
      "bullet one plus one", "play one plus one", "one one game",
      "select one plus one", "choose one plus one",
      
      "select 1 plus 1", "choose 1 plus 1", "play 1 plus 1",
      "select one one", "choose one one", "play one one",
    ],
    
    SELECT_BULLET_2_0: [
      "2 plus 0", "2 and 0", "2 0", "bullet 2 0", "2 plus zero",
      "two plus zero", "two and zero", "2+0", "bullet two plus zero",
      
      "2 minutes", "two minutes", "2 minute", "two minute",
      "2 minutes no increment", "two minutes zero seconds",
      
      "two plus zero", "two and zero", "two zero",
      
      "bullet two minutes", "play two minutes", "two minute game",
      "select two minutes", "choose two minutes",
      
      "select 2 plus 0", "choose 2 plus 0", "play 2 plus 0",
      "select two plus zero", "choose two plus zero", "play two plus zero",
      
      "two min", "2 min", "bullet 2",
    ],
    
    SELECT_BULLET_2_1: [
      "2 plus 1", "2 and 1", "2 1", "bullet 2 1", "2 plus one",
      "two plus one", "two and one", "2+1", "bullet two plus one",
      
      "2 minutes 1 second", "two minutes one second",
      "2 minute plus 1 second", "two minutes plus one second",
      
      "two plus one", "two and one", "two one",
      
      "bullet two one", "play two one", "two one game",
      "select two one", "choose two one",
      
      "select 2 plus 1", "choose 2 plus 1", "play 2 plus 1",
      "select two one", "choose two one", "play two one",
    ],
    
    SELECT_BULLET_30_0: [
      "30 seconds", "30 second", "30 0", "bullet 30", "half minute",
      "zero point five", "0 point 5", "0.5+0", "30+0", 
      "bullet thirty plus zero", "thirty seconds",
      
      "30 sec", "thirty sec", "half a minute", "point five minutes",
      "0.5 minutes", "half minute game",
      
      "select 30 seconds", "choose 30 seconds", "play 30 seconds",
      "select thirty seconds", "choose thirty seconds",
      
      "bullet 30 seconds", "thirty second bullet", "half minute bullet",
      "ultra bullet", "super bullet",
    ],

    // ========== BLITZ TIME CONTROLS (3+0, 3+2, 4+2, 5+0, 5+3) ==========
    SELECT_BLITZ_3_0: [
      "3 plus 0", "3 and 0", "3 0", "blitz 3 0", "3 plus zero",
      "three plus zero", "three and zero", "3+0", "blitz three plus zero",
      
      "3 minutes", "three minutes", "3 minute", "three minute",
      "3 minutes no increment", "three minutes zero seconds",
      "3 min", "three min",
      
      "three plus zero", "three and zero", "three zero",
      
      "blitz three minutes", "play three minutes", "three minute game",
      "select three minutes", "choose three minutes", "three minute blitz",
      
      "select 3 plus 0", "choose 3 plus 0", "play 3 plus 0",
      "select three plus zero", "choose three plus zero",
      
      "blitz 3", "3 minute blitz",
    ],
    
    SELECT_BLITZ_3_2: [
      "3 plus 2", "3 and 2", "3 2", "blitz 3 2", "3 plus two",
      "three plus two", "three and two", "3+2", "blitz three plus two",
      "blits three plus two", "blitz three two",
      
      "3 minutes 2 seconds", "three minutes two seconds",
      "3 minute plus 2 seconds", "three minutes plus two seconds",
      "3 min 2 sec", "three min two sec",
      
      "three plus two", "three and two", "three two",
      
      "blitz three plus two", "play three plus two", "three two game",
      "select three plus two", "choose three plus two",
      
      "select 3 plus 2", "choose 3 plus 2", "play 3 plus 2",
      "select three two", "choose three two", "play three two",
      
      "blitz 3 2", "three two blitz",
    ],
    
    SELECT_BLITZ_4_2: [
      "4 plus 2", "4 and 2", "4 2", "blitz 4 2", "4 plus two",
      "four plus two", "four and two", "4+2", "blitz four plus two",
      
      "4 minutes 2 seconds", "four minutes two seconds",
      "4 minute plus 2 seconds", "four minutes plus two seconds",
      "4 min 2 sec", "four min two sec",
      
      "four plus two", "four and two", "four two",
      
      "blitz four plus two", "play four plus two", "four two game",
      "select four plus two", "choose four plus two",
      
      "select 4 plus 2", "choose 4 plus 2", "play 4 plus 2",
      "select four two", "choose four two", "play four two",
      
      "blitz 4", "four minute blitz",
    ],
    
    SELECT_BLITZ_5_0: [
      "5 plus 0", "5 and 0", "5 0", "blitz 5 0", "5 plus zero",
      "five plus zero", "five and zero", "5+0", "blitz five plus zero",
      
      "5 minutes", "five minutes", "5 minute", "five minute",
      "5 minutes no increment", "five minutes zero seconds",
      "5 min", "five min",
      
      "five plus zero", "five and zero", "five zero",
      
      "blitz five minutes", "play five minutes", "five minute game",
      "select five minutes", "choose five minutes", "five minute blitz",
      
      "select 5 plus 0", "choose 5 plus 0", "play 5 plus 0",
      "select five plus zero", "choose five plus zero",
      
      "blitz 5", "five minute blitz",
    ],
    
    SELECT_BLITZ_5_3: [
      "5 plus 3", "5 and 3", "5 3", "blitz 5 3", "5 plus three",
      "five plus three", "five and three", "5+3", "blitz five plus three",
      
      "5 minutes 3 seconds", "five minutes three seconds",
      "5 minute plus 3 seconds", "five minutes plus three seconds",
      "5 min 3 sec", "five min three sec",
      
      "five plus three", "five and three", "five three",
      
      "blitz five plus three", "play five plus three", "five three game",
      "select five plus three", "choose five plus three",
      
      "select 5 plus 3", "choose 5 plus 3", "play 5 plus 3",
      "select five three", "choose five three", "play five three",
      
      "blitz 5 3", "five three blitz",
    ],

    // ========== RAPID TIME CONTROLS (10+0, 10+5, 15+0, 15+10, 25+10) ==========
    SELECT_RAPID_10_0: [
      "10 plus 0", "10 and 0", "10 0", "rapid 10 0", "10 plus zero",
      "ten plus zero", "ten and zero", "10+0", "rapid ten plus zero",
      
      "10 minutes", "ten minutes", "10 minute", "ten minute",
      "10 minutes no increment", "ten minutes zero seconds",
      "10 min", "ten min",
      
      "ten plus zero", "ten and zero", "ten zero",
      
      "rapid ten minutes", "play ten minutes", "ten minute game",
      "select ten minutes", "choose ten minutes", "ten minute rapid",
      
      "select 10 plus 0", "choose 10 plus 0", "play 10 plus 0",
      "select ten plus zero", "choose ten plus zero",
      
      "rapid 10", "ten minute rapid", "10 minute rapid",
    ],
    
    SELECT_RAPID_10_5: [
      "10 plus 5", "10 and 5", "10 5", "rapid 10 5", "10 plus five",
      "ten plus five", "ten and five", "10+5", "rapid ten plus five",
      
      "10 minutes 5 seconds", "ten minutes five seconds",
      "10 minute plus 5 seconds", "ten minutes plus five seconds",
      "10 min 5 sec", "ten min five sec",
      
      "ten plus five", "ten and five", "ten five",
      
      "rapid ten plus five", "play ten plus five", "ten five game",
      "select ten plus five", "choose ten plus five",
      
      "select 10 plus 5", "choose 10 plus 5", "play 10 plus 5",
      "select ten five", "choose ten five", "play ten five",
      
      "rapid 10 5", "ten five rapid",
    ],
    
    SELECT_RAPID_15_0: [
      "15 plus 0", "15 and 0", "15 0", "rapid 15 0", "15 plus zero",
      "fifteen plus zero", "fifteen and zero", "15+0", "rapid fifteen plus zero",
      
      "15 minutes", "fifteen minutes", "15 minute", "fifteen minute",
      "15 minutes no increment", "fifteen minutes zero seconds",
      "15 min", "fifteen min",
      
      "fifteen plus zero", "fifteen and zero", "fifteen zero",
      
      "rapid fifteen minutes", "play fifteen minutes", "fifteen minute game",
      "select fifteen minutes", "choose fifteen minutes", "fifteen minute rapid",
      
      "select 15 plus 0", "choose 15 plus 0", "play 15 plus 0",
      "select fifteen plus zero", "choose fifteen plus zero",
      "select fifteen zero", "choose fifteen zero",
      
      "rapid 15", "fifteen minute rapid", "15 minute rapid",
      "rapid fifteen", "play rapid fifteen",
    ],
    
    SELECT_RAPID_15_10: [
      "15 plus 10", "15 and 10", "15 10", "rapid 15 10", "15 plus ten",
      "fifteen plus ten", "fifteen and ten", "15+10", "rapid fifteen plus ten",
      
      "15 minutes 10 seconds", "fifteen minutes ten seconds",
      "15 minute plus 10 seconds", "fifteen minutes plus ten seconds",
      "15 min 10 sec", "fifteen min ten sec",
      
      "fifteen plus ten", "fifteen and ten", "fifteen ten",
      
      "rapid fifteen plus ten", "play fifteen plus ten", "fifteen ten game",
      "select fifteen plus ten", "choose fifteen plus ten",
      
      "select 15 plus 10", "choose 15 plus 10", "play 15 plus 10",
      "select fifteen ten", "choose fifteen ten", "play fifteen ten",
      "select fifteen plus ten", "choose fifteen plus ten",
      
      "rapid 15 10", "fifteen ten rapid", "rapid fifteen ten",
      "play rapid 15 plus 10", "select rapid fifteen plus ten",
    ],
    
    SELECT_RAPID_25_10: [
      "rapid 25 10", "rapid 25 plus 10", "25 plus 10", "25 and 10", 
      "25 10", "rapid 25 10", "25 plus ten",
      "twenty five plus ten", "twenty five and ten", "25+10", 
      "rapid twenty five plus ten", "rapid twentyfive plus ten",
      
      "25 minutes 10 seconds", "twenty five minutes ten seconds",
      "25 minute plus 10 seconds", "twenty five minutes plus ten seconds",
      "25 min 10 sec", "twenty five min ten sec",
      
      "twenty five plus ten", "twenty five and ten", "twenty five ten",
      "twentyfive plus ten", "twentyfive and ten", "twentyfive ten",
      
      "rapid twenty five plus ten", "play twenty five plus ten", 
      "twenty five ten game", "select twenty five plus ten",
      "choose twenty five plus ten",
      
      "select 25 plus 10", "choose 25 plus 10", "play 25 plus 10",
      "select twenty five ten", "choose twenty five ten", 
      "play twenty five ten", "select twentyfive ten",
      
      "rapid 25", "twenty five minute rapid", "25 minute rapid",
      "rapid twenty five", "play rapid 25 plus 10",
      "select rapid twenty five plus ten", "choose rapid twentyfive plus ten",
    ],

    // ========== CLASSICAL TIME CONTROLS (60+0, 60+30, 90+30, 120+30) ==========
    SELECT_CLASSICAL_60_0: [
      "60 plus 0", "60 and 0", "60 0", "classical 60 0", "60 plus zero",
      "sixty plus zero", "sixty and zero", "60+0",
      
      "1 hour", "one hour", "1 hour 0", "one hour zero",
      "1 hour no increment", "one hour no increment",
      "60 minutes", "sixty minutes",
      
      "sixty plus zero", "sixty and zero", "sixty zero",
      
      "classical one hour", "play one hour", "one hour game",
      "select one hour", "choose one hour", "one hour classical",
      
      "select 60 plus 0", "choose 60 plus 0", "play 60 plus 0",
      "select sixty plus zero", "choose sixty plus zero",
      "select one hour", "choose one hour", "play one hour",
      
      "classical 60", "sixty minute classical", "hour game",
      "classical one hour plus zero", "play classical one hour",
    ],
    
    SELECT_CLASSICAL_60_30: [
      "60 plus 30", "60 and 30", "60 30", "classical 60 30", "60 plus thirty",
      "sixty plus thirty", "sixty and thirty", "60+30",
      
      "1 hour 30", "one hour thirty", "1 hour 30 seconds",
      "one hour thirty seconds", "60 minutes 30 seconds",
      "sixty minutes thirty seconds",
      
      "sixty plus thirty", "sixty and thirty", "sixty thirty",
      
      "classical one hour thirty", "play one hour thirty",
      "one hour thirty game", "select one hour thirty",
      "choose one hour thirty",
      
      "select 60 plus 30", "choose 60 plus 30", "play 60 plus 30",
      "select sixty thirty", "choose sixty thirty", "play sixty thirty",
      "select one hour thirty", "choose one hour thirty",
      
      "classical 60 30", "hour thirty", "classical hour thirty",
      "play classical 60 plus 30", "select classical sixty plus thirty",
    ],
    
    SELECT_CLASSICAL_90_30: [
      "90 plus 30", "90 and 30", "90 30", "classical 90 30", "90 plus thirty",
      "ninety plus thirty", "ninety and thirty", "90+30",
      
      "1 hour 30", "one hour thirty", "1 hour 30 minutes",
      "one hour thirty minutes", "90 minutes", "ninety minutes",
      "90 minutes 30 seconds", "ninety minutes thirty seconds",
      "1.5 hours", "one and a half hours",
      
      "ninety plus thirty", "ninety and thirty", "ninety thirty",
      
      "classical ninety thirty", "play ninety thirty",
      "ninety thirty game", "select ninety thirty",
      "choose ninety thirty",
      
      "select 90 plus 30", "choose 90 plus 30", "play 90 plus 30",
      "select ninety thirty", "choose ninety thirty", "play ninety thirty",
      "select one hour thirty minutes", "choose one hour thirty minutes",
      
      "classical 90", "ninety minute classical", 
      "classical ninety plus thirty", "play classical 90 plus 30",
      "select classical ninety thirty", "hour and a half",
    ],
    
    SELECT_CLASSICAL_120_30: [
      "120 plus 30", "120 and 30", "120 30", "classical 120 30", 
      "120 plus thirty", "one twenty plus thirty",
      "one hundred twenty plus thirty", "hundred twenty plus thirty",
      
      "2 hours", "two hours", "2 hour 30", "two hour thirty",
      "2 hours 30 seconds", "two hours thirty seconds",
      "120 minutes", "one hundred twenty minutes",
      "120 minutes 30 seconds",
      
      "one twenty plus thirty", "one twenty and thirty", "one twenty thirty",
      "hundred twenty plus thirty", "hundred twenty and thirty",
      
      "classical two hours", "play two hours", "two hour game",
      "select two hours", "choose two hours", "two hour classical",
      
      "select 120 plus 30", "choose 120 plus 30", "play 120 plus 30",
      "select one twenty thirty", "choose one twenty thirty",
      "select two hours", "choose two hours", "play two hours",
      "select two hour thirty", "choose two hour thirty",
      
      "classical 120", "two hour classical", "120 minute classical",
      "classical one twenty plus thirty", "classical two hours thirty",
      "play classical 120 plus 30", "select classical two hours",
      "long game", "very long game",
    ],

    // ========== OPPONENT SELECTION ==========
    SELECT_RANDOM: [
      "random", "play random", "random opponent", "random player",
      "anyone", "find opponent", "match me", "auto match", 
      "random person", "any opponent", "find match",
      
      "play with random", "play against random", "random match",
      "find random opponent", "find random player",
      
      "select random", "choose random", "pick random",
      "random game", "match with random", "match random",
      
      "find me an opponent", "find me a player", "find someone",
      "play with anyone", "play against anyone",
      
      "matchmaking", "auto matchmaking", "quick match",
      "find game", "search opponent", "search for opponent",
    ],
    
    SELECT_FRIENDS: [
      "friends", "play with friends", "with friends", "friend",
      "play friends", "friends mode", "find friend", "invite friend",
      
      "select friends", "choose friends", "pick friends",
      "friends game", "friend game", "friendly game",
      
      "play with friend", "play against friend", "challenge friend",
      "friend match", "friendly match",
      
      "invite a friend", "send invite", "create private game",
      "private game", "private match", "custom game",
      
      "play with my friend", "play against my friend",
      "friend list", "show friends",
    ],

    // ========== CHESS-SPECIFIC COMMANDS ==========
    RESIGN: [
      "resign", "i resign", "i give up", "give up", "surrender",
      "forfeit", "i quit", "quit", "i lose", "concede",
      "i surrender", "resign game", "resign the game",
    ],
    
    OFFER_DRAW: [
      "draw", "offer draw", "draw offer", "request draw",
      "propose draw", "suggest draw", "draw please",
      "can we draw", "draw game", "offer a draw",
    ],
    
    ACCEPT_DRAW: [
      "accept draw", "accept", "yes draw", "agree to draw",
      "draw accepted", "ok draw", "sure draw", "yes",
      "accept draw offer", "agree",
    ],
    
    DECLINE_DRAW: [
      "decline draw", "decline", "no draw", "refuse draw",
      "draw declined", "no", "refuse", "reject draw",
      "decline draw offer", "reject",
    ],
    
    NEW_GAME: [
      "new game", "start new game", "new match", "rematch",
      "play again", "another game", "one more game",
      "restart", "start over", "begin new game",
      "new", "fresh game", "another match",
    ],
    
    UNDO_MOVE: [
      "undo", "undo move", "take back", "take back move",
      "undo last move", "go back", "reverse", "undo that",
      "take it back", "undo last", "previous move",
    ],
    
    FLIP_BOARD: [
      "flip board", "flip", "rotate board", "turn board",
      "reverse board", "flip the board", "rotate",
      "turn the board", "switch sides", "flip view",
    ],
    
    SHOW_MOVES: [
      "show moves", "legal moves", "show legal moves",
      "possible moves", "show possible moves", "what can i do",
      "show options", "available moves", "show available moves",
      "highlight moves", "show hints",
    ],
  };

  // ============================================================================
  // TEXT NORMALIZATION
  // ============================================================================
  
  /**
   * Normalize text with phonetic replacements for better accent handling
   */
  private static normalizeText(text: string): string {
    let normalized = text.toLowerCase().trim();
    
    // Remove common filler words/sounds
    normalized = normalized.replace(/\b(um|uh|er|ah|like|you know|basically|actually)\b/gi, ' ');
    
    // Clean up extra spaces
    normalized = normalized.replace(/\s+/g, ' ').trim();

    // Apply phonetic mappings (word by word)
    const words = normalized.split(/\s+/);
    const normalizedWords = words.map(word => {
      // Remove punctuation from word for matching
      const cleanWord = word.replace(/[.,!?;:'"]/g, '');
      return this.phoneticMap[cleanWord] || word;
    });
    normalized = normalizedWords.join(' ');

    // Replace number words with digits (handle multi-word numbers first)
    // Sort by length descending to match longer phrases first
    const numberEntries = Object.entries(this.numberMap)
      .sort((a, b) => b[0].length - a[0].length);
    
    for (const [word, digit] of numberEntries) {
      const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      normalized = normalized.replace(regex, digit);
    }

    // Normalize common separators for time controls
    normalized = normalized.replace(/\s*\+\s*/g, ' plus ');
    normalized = normalized.replace(/\s*&\s*/g, ' and ');
    normalized = normalized.replace(/\s*-\s*/g, ' ');

    return normalized;
  }

  // ============================================================================
  // COMMAND PARSING
  // ============================================================================
  
  /**
   * Parse navigation and control commands
   */
  static parseNavigationCommand(transcript: string): ParsedCommand | null {
    const normalized = this.normalizeText(transcript);

    // Check each intent and its patterns
    for (const [intent, patterns] of Object.entries(this.commandPatterns)) {
      for (const pattern of patterns) {
        // Use word boundaries for better matching
        const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (regex.test(normalized) || normalized.includes(pattern)) {
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

  // ============================================================================
  // CHESS MOVE PARSING
  // ============================================================================
  
  /**
   * Enhanced chess move parser with comprehensive pattern matching
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

    // ========== PATTERN 1: CASTLING (highest priority) ==========
    if (/\b(castle|castles|castling)\b/i.test(processed)) {
      // Kingside castling
      if (/\b(king|kings|kingside|king.?side|short)\b/i.test(processed)) {
        const move = legalMoves.find(m => m.san === "O-O");
        if (move) {
          console.log("✅ Kingside castling");
          return move.san;
        }
      }
      // Queenside castling
      if (/\b(queen|queens|queenside|queen.?side|long)\b/i.test(processed)) {
        const move = legalMoves.find(m => m.san === "O-O-O");
        if (move) {
          console.log("✅ Queenside castling");
          return move.san;
        }
      }
    }

    // ========== HELPER: Extract square from text ==========
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

    // ========== PATTERN 2: SIMPLE SQUARE MOVE (e.g., "e4", "d4") ==========
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

    // ========== PATTERN 3: PIECE TO SQUARE (e.g., "knight to f3") ==========
    const pieceToPattern = new RegExp(
      `\\b(${pieceNames})\\s+(?:to|at|on|too|tu|toh|goes?|move|moves)?\\s*([a-h])\\s*[-_]?\\s*([1-8]|one|two|three|four|five|six|seven|eight|ek|do|teen|char|panch|chha|saat|aat)\\b`,
      'i'
    );
    
    const pieceToMatch = processed.match(pieceToPattern);
    if (pieceToMatch) {
      const pieceName = pieceToMatch[1].toLowerCase();
      let file = pieceToMatch[2].toLowerCase();
      let rank = pieceToMatch[3].toLowerCase();
      
      // File should be a single letter a-h, validate first
      if (!/^[a-h]$/.test(file)) {
        file = this.fileMap[file] || file;
      }
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
        
        // Check for "from" square
        const fromPattern = /from\s+([a-h])[-_]?([1-8])/i;
        const fromMatch = processed.match(fromPattern);
        if (fromMatch) {
          const fromSquare = fromMatch[1] + fromMatch[2];
          const specific = candidates.find(m => m.from === fromSquare);
          if (specific) {
            console.log("✅ Disambiguated move:", specific.san);
            return specific.san;
          }
        }
        
        // Return first candidate
        console.log("✅ First candidate:", candidates[0].san);
        return candidates[0].san;
      }
    }

    // ========== PATTERN 4: PIECE TAKES SQUARE (e.g., "knight takes e5") ==========
    const pieceTakesPattern = new RegExp(
      `\\b(${pieceNames})\\s*(?:takes?|captures?|x|tek|teyk|catch|ketch|grabs?|eats?)\\s*([a-h])\\s*[-_]?\\s*([1-8]|one|two|three|four|five|six|seven|eight|ek|do|teen|char|panch|chha|saat|aat)\\b`,
      'i'
    );
    
    const pieceTakesMatch = processed.match(pieceTakesPattern);
    if (pieceTakesMatch) {
      const pieceName = pieceTakesMatch[1].toLowerCase();
      let file = pieceTakesMatch[2].toLowerCase();
      let rank = pieceTakesMatch[3].toLowerCase();
      
      // File should be a single letter a-h, validate first
      if (!/^[a-h]$/.test(file)) {
        file = this.fileMap[file] || file;
      }
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

    // ========== PATTERN 5: PAWN TAKES (e.g., "e takes d5") ==========
    const pawnTakesPattern = /\b([a-h]|ay|eh|be|see|de|ee|ef|ge|aitch)\s*(?:takes?|captures?|x|tek|teyk|catch|grabs?|eats?)\s*([a-h]|ay|eh|be|see|de|ee|ef|ge|aitch)\s*[-_]?\s*([1-8]|one|two|three|four|five|six|seven|eight|ek|do|teen|char|panch|chha|saat|aat)\b/i;
    
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

    // ========== PATTERN 6: PROMOTION (e.g., "e8 queen", "pawn to e8 promote to queen") ==========
    const promotionPattern = /\b([a-h])?\s*(?:[27])?\s*(?:to|on)?\s*([a-h])\s*[-_]?\s*([18])\s*(?:promote|promotion|equals?|becomes?|queen|rook|bishop|knight|kween|rok|bishap|night)/i;
    
    const promotionMatch = processed.match(promotionPattern);
    if (promotionMatch) {
      let toFile = promotionMatch[2].toLowerCase();
      let toRank = promotionMatch[3].toLowerCase();
      
      toFile = this.fileMap[toFile] || toFile;
      toRank = this.rankMap[toRank] || toRank;
      
      const toSquare = toFile + toRank;
      
      // Determine promotion piece
      let promoPiece = 'q'; // Default to queen
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

    // ========== PATTERN 7: DISAMBIGUATION (e.g., "knight from g1 to f3") ==========
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

    // ========== PATTERN 8: MOVE BY DESCRIPTION (e.g., "develop knight", "castle") ==========
    // Common chess move descriptions
    const descriptiveMoves: { [key: string]: RegExp } = {
      "develop knight": /develop\s+(the\s+)?knight/i,
      "develop bishop": /develop\s+(the\s+)?bishop/i,
      "control center": /control\s+(the\s+)?center/i,
      "attack": /attack/i,
      "defend": /defend|protect/i,
    };

    for (const [description, pattern] of Object.entries(descriptiveMoves)) {
      if (pattern.test(processed)) {
        console.log(`💡 Descriptive command: ${description}`);
        // This would require more sophisticated logic based on position
        // For now, just log it
      }
    }

    // ========== PATTERN 9: DIRECT SAN MATCH ==========
    const compactText = processed.replace(/\s+/g, '');
    for (const move of legalMoves) {
      const compactSan = move.san.replace(/[+#]/g, '').toLowerCase();
      if (compactText.includes(compactSan)) {
        console.log("✅ Direct SAN match:", move.san);
        return move.san;
      }
    }

    // ========== PATTERN 10: FALLBACK - Any square mentioned ==========
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

  // ============================================================================
  // MAIN PARSE FUNCTION
  // ============================================================================
  
  /**
   * Main parse function - routes to appropriate parser
   */
  static parse(transcript: string, chess?: Chess): ParsedCommand | null {
    // Try navigation/control commands first
    const navCommand = this.parseNavigationCommand(transcript);
    if (navCommand) {
      return navCommand;
    }

    // Try chess moves if chess instance provided
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

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  
  /**
   * Get all available commands for a given context
   */
  static getAvailableCommands(context: 'general' | 'game' | 'time_selection' = 'general'): string[] {
    const commands: string[] = [];
    
    for (const [intent, patterns] of Object.entries(this.commandPatterns)) {
      if (context === 'general') {
        if (intent.startsWith('VOICE_') || intent.startsWith('GO_') || intent.startsWith('SHOW_')) {
          commands.push(...patterns.slice(0, 3)); // Take first 3 examples
        }
      } else if (context === 'game') {
        if (intent.startsWith('RESIGN') || intent.startsWith('OFFER_') || 
            intent.startsWith('ACCEPT_') || intent.startsWith('NEW_') ||
            intent.startsWith('UNDO_') || intent.startsWith('FLIP_')) {
          commands.push(...patterns.slice(0, 3));
        }
      } else if (context === 'time_selection') {
        if (intent.startsWith('SELECT_')) {
          commands.push(patterns[0]); // Just first example
        }
      }
    }
    
    return commands;
  }

  /**
   * Validate a time control command
   */
  static validateTimeControl(transcript: string): { valid: boolean; timeControl?: string } {
    const normalized = this.normalizeText(transcript);
    
    for (const [intent, patterns] of Object.entries(this.commandPatterns)) {
      if (intent.startsWith('SELECT_')) {
        for (const pattern of patterns) {
          if (normalized.includes(pattern)) {
            return { valid: true, timeControl: intent };
          }
        }
      }
    }
    
    return { valid: false };
  }
}

export default GlobalVoiceParser;