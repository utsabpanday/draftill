import { ScreenplayNode } from './importersExporters';

export interface ScriptTemplate {
  id: string;
  name: string;
  description: string;
  targetPageCount: number;
  estimatedRuntimeMin: number;
  nodes: ScreenplayNode[];
}

export const PREBUILT_TEMPLATES: ScriptTemplate[] = [
  {
    id: 'feature-three-act',
    name: 'Feature Film (Three-Act Structure)',
    description: 'Standard 3-act Hollywood feature structure (Setup, Confrontation, Resolution). Perfect for standard feature scripts.',
    targetPageCount: 110,
    estimatedRuntimeMin: 110,
    nodes: [
      { type: 'sceneHeading', text: 'INT. COFFEE SHOP - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[ACT I: SETUP - Introduces the protagonist, their ordinary world, and the inciting incident by page 10-12.]' },
      { type: 'character', text: 'PROTAGONIST' },
      { type: 'dialogue', text: 'Everything is fine. Until it isn\'t.' },
      { type: 'sceneHeading', text: 'EXT. STREET - NIGHT', id: crypto.randomUUID() },
      { type: 'action', text: '[PLOT POINT I - Page 25-30: Protagonist makes a definitive choice to enter the special world of Act II.]' },
      { type: 'sceneHeading', text: 'INT. MYSTERIOUS OFFICE - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[ACT II: CONFRONTATION - Protagonist faces rising obstacles, training, subplots, and the midpoint shift at page 55.]' },
      { type: 'sceneHeading', text: 'EXT. BRIDGE - NIGHT', id: crypto.randomUUID() },
      { type: 'action', text: '[PLOT POINT II / DARK NIGHT OF THE SOUL - Page 75-85: All is lost. The lowest point before discovering the final resolution key.]' },
      { type: 'sceneHeading', text: 'INT. STADIUM - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[ACT III: CLIMAX - The final showdown. The protagonist solves the main problem using lessons learned.]' }
    ]
  },
  {
    id: 'feature-save-the-cat',
    name: 'Feature Film (Save the Cat Structure)',
    description: 'Blake Snyder\'s famous 15-beat screenplay formula with precise beat headings.',
    targetPageCount: 100,
    estimatedRuntimeMin: 100,
    nodes: [
      { type: 'sceneHeading', text: 'INT. APARTMENT - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[BEAT 1: OPENING IMAGE (Pages 1) - Sets the tone and starting mood.]' },
      { type: 'action', text: '[BEAT 2: THEME STATED (Page 5) - Someone mentions a truth that the hero needs to learn.]' },
      { type: 'action', text: '[BEAT 3: SETUP (Pages 1-10) - Exploration of the hero\'s flaws and missing pieces.]' },
      { type: 'sceneHeading', text: 'EXT. CAFE - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[BEAT 4: CATALYST (Page 12) - The life-changing knock on the door or telegram.]' },
      { type: 'action', text: '[BEAT 5: DEBATE (Pages 12-25) - Hero doubts their call or tries to avoid the journey.]' },
      { type: 'sceneHeading', text: 'INT. TRAIN - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[BEAT 6: BREAK INTO TWO (Page 25) - Definitive step into the new Act.]' },
      { type: 'action', text: '[BEAT 7: B STORY (Page 30) - Love interest or mentor relationship is introduced.]' },
      { type: 'action', text: '[BEAT 8: FUN & GAMES (Pages 30-55) - The premise of the movie. Cool sequences.]' },
      { type: 'sceneHeading', text: 'INT. LUXURY HOTEL - NIGHT', id: crypto.randomUUID() },
      { type: 'action', text: '[BEAT 9: MIDPOINT (Page 55) - False peak or false collapse. Stakes are raised.]' },
      { type: 'action', text: '[BEAT 10: BAD GUYS CLOSE IN (Pages 55-75) - Pressures mount, internal conflicts grow.]' },
      { type: 'sceneHeading', text: 'EXT. ALLEYWAY - NIGHT', id: crypto.randomUUID() },
      { type: 'action', text: '[BEAT 11: ALL IS LOST (Page 75) - False defeat, whiff of death.]' },
      { type: 'action', text: '[BEAT 12: DARK NIGHT OF THE SOUL (Pages 75-85) - Deep reflection before final push.]' },
      { type: 'sceneHeading', text: 'INT. HQ - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[BEAT 13: BREAK INTO THREE (Page 85) - New idea emerges to fix the situation.]' },
      { type: 'action', text: '[BEAT 14: FINALE (Pages 85-110) - Hero executes the plan, defeats antagonists.]' },
      { type: 'action', text: '[BEAT 15: FINAL IMAGE (Page 110) - Mirror image of the opening scene, showing change.]' }
    ]
  },
  {
    id: 'tv-drama-hour',
    name: 'TV Pilot - Hour-Long Drama',
    description: 'Four or five-act structure with a teaser. Perfect for HBO, Netflix, or network drama pilots.',
    targetPageCount: 60,
    estimatedRuntimeMin: 60,
    nodes: [
      { type: 'sceneHeading', text: 'EXT. DOCK - NIGHT', id: crypto.randomUUID() },
      { type: 'action', text: '[TEASER - Page 1-5: A high-intensity hook. Sets up the main mystery or threat.]' },
      { type: 'sceneHeading', text: 'INT. POLICE STATION - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[ACT I - Pages 5-15: Introducing the ensemble cast, main investigations, and conflicts.]' },
      { type: 'sceneHeading', text: 'EXT. STREETS - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[ACT II - Pages 15-30: Complications set in. Characters head down paths of no return.]' },
      { type: 'sceneHeading', text: 'INT. CLUB - NIGHT', id: crypto.randomUUID() },
      { type: 'action', text: '[ACT III - Pages 30-45: Escalation. The antagonists strike back; key secrets are revealed.]' },
      { type: 'sceneHeading', text: 'EXT. WAREHOUSE - NIGHT', id: crypto.randomUUID() },
      { type: 'action', text: '[ACT IV - Pages 45-55: Climax of the episode\'s plot. Major cliffhanger setup.]' },
      { type: 'sceneHeading', text: 'INT. APARTMENT - NIGHT', id: crypto.randomUUID() },
      { type: 'action', text: '[ACT V / EPILOGUE - Pages 55-60: Dealing with immediate fallout. Sets up the season arc.]' }
    ]
  },
  {
    id: 'tv-sitcom-multicam',
    name: 'TV Pilot - Half-Hour Sitcom (Multi-Cam)',
    description: 'Traditional multi-camera sitcom format. Character dialogues are double-spaced, scene descriptions capitalized, and pages structured for a live studio audience.',
    targetPageCount: 45,
    estimatedRuntimeMin: 30,
    nodes: [
      { type: 'sceneHeading', text: 'INT. THE APARTMENT LIVING ROOM - DAY', id: crypto.randomUUID() },
      { type: 'action', text: 'THE LIGHTS RISE ON THE LIVING ROOM. CHEERS AND LAUGHTER FROM THE AUDIENCE AS JERRY WALKS IN.' },
      { type: 'character', text: 'JERRY' },
      { type: 'dialogue', text: 'What is the deal with multi-cam scripts? You double-space everything!' },
      { type: 'character', text: 'GEORGE' },
      { type: 'parenthetical', text: '(entering, agitated)' },
      { type: 'dialogue', text: 'I don\'t know, Jerry! But I like the applause! It makes me feel important!' }
    ]
  },
  {
    id: 'tv-sitcom-singlecam',
    name: 'TV Pilot - Half-Hour Single-Cam',
    description: 'Modern single-camera sitcom structure (e.g. The Office, Modern Family). Fast paced, structured with three acts and a tag.',
    targetPageCount: 32,
    estimatedRuntimeMin: 30,
    nodes: [
      { type: 'sceneHeading', text: 'INT. OFFICE KITCHEN - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[COLD OPEN - Pages 1-3: A hilarious standalone joke or rapid hook before title sequence.]' },
      { type: 'character', text: 'JIM' },
      { type: 'parenthetical', text: '(looking at camera)' },
      { type: 'dialogue', text: 'It\'s just another Monday.' }
    ]
  },
  {
    id: 'short-film',
    name: 'Short Film',
    description: 'Sleek 10-page structure with a single clear twist or emotional peak.',
    targetPageCount: 10,
    estimatedRuntimeMin: 10,
    nodes: [
      { type: 'sceneHeading', text: 'INT. ELEVATOR - NIGHT', id: crypto.randomUUID() },
      { type: 'action', text: '[SETUP - Pages 1-3: Establish character, goal, and immediate obstacle in a confined space.]' },
      { type: 'character', text: 'STRANGER' },
      { type: 'dialogue', text: 'Do you believe in fate?' }
    ]
  },
  {
    id: 'micro-short',
    name: 'Micro-Short / Social Video (< 5 min)',
    description: 'Ultra-short script format. Tailored for TikTok, Instagram Reels, or YouTube Shorts.',
    targetPageCount: 3,
    estimatedRuntimeMin: 3,
    nodes: [
      { type: 'sceneHeading', text: 'EXT. PARK - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[0-10 SECONDS: Visual hook. Instant high-energy activity.]' },
      { type: 'character', text: 'CREATOR' },
      { type: 'dialogue', text: 'Here are three secrets they don\'t want you to know about screenwriting.' }
    ]
  },
  {
    id: 'commercial-ad',
    name: 'Commercial / Ad Script (:15, :30, :60)',
    description: 'Commercial dual-column format split by Video (left) and Audio (right). Custom template rules auto-applied.',
    targetPageCount: 2,
    estimatedRuntimeMin: 1,
    nodes: [
      { type: 'sceneHeading', text: 'INT. BATHROOM - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[VISUAL SHOT: Close-up of clean running water.]' },
      { type: 'character', text: 'NARRATOR (V.O.)' },
      { type: 'dialogue', text: 'Experience purity. (:15 Second Hook)' }
    ]
  },
  {
    id: 'stage-play',
    name: 'Stage Play',
    description: 'Classic theater script template. Indentations are centered around acts/scenes, stage directions in brackets.',
    targetPageCount: 80,
    estimatedRuntimeMin: 120,
    nodes: [
      { type: 'sceneHeading', text: 'ACT I, SCENE 1', id: crypto.randomUUID() },
      { type: 'action', text: '[AT RISE: The stage is set with a single wooden chair under a blue spotlight.]' },
      { type: 'character', text: 'HAMLET' },
      { type: 'dialogue', text: 'To be, or not to be, that is the question.' }
    ]
  },
  {
    id: 'audio-drama',
    name: 'Radio / Audio Drama Script',
    description: 'Specifically tailored for auditory elements, voice performance, sound effects (SFX), and music cues.',
    targetPageCount: 30,
    estimatedRuntimeMin: 30,
    nodes: [
      { type: 'sceneHeading', text: 'SCENE 1: THE HAUNTED FOREST', id: crypto.randomUUID() },
      { type: 'action', text: '[SFX: WIND HOWLING, BRANCHES CRACKING UNDERFOOT]' },
      { type: 'character', text: 'SARAH' },
      { type: 'dialogue', text: 'Is anyone there? (Whispering. Echo filter applied.)' },
      { type: 'action', text: '[SFX: A SUDDEN DISTANT CRY OF AN OWL]' }
    ]
  },
  {
    id: 'podcast-script',
    name: 'Podcast Script',
    description: 'Formatted guide for interviewers, co-hosts, ad reads, and intro/outro loops.',
    targetPageCount: 15,
    estimatedRuntimeMin: 45,
    nodes: [
      { type: 'sceneHeading', text: 'INTRO & MUSIC CUE', id: crypto.randomUUID() },
      { type: 'action', text: '[INTRO MUSIC - Upbeat synth tracks. Fade under after 10 seconds.]' },
      { type: 'character', text: 'HOST' },
      { type: 'dialogue', text: 'Welcome back to the Draftill creative cast. Today, we talk screenwriting.' }
    ]
  },
  {
    id: 'music-video',
    name: 'Music Video Treatment',
    description: 'Visual treatment script. Focuses heavily on camera angles, lighting designs, lyric timings, and dance choreography cues.',
    targetPageCount: 5,
    estimatedRuntimeMin: 4,
    nodes: [
      { type: 'sceneHeading', text: 'VERSE 1 - CLUTTERED APARTMENT', id: crypto.randomUUID() },
      { type: 'action', text: '[LYRIC CUE: "When the lights go down..."]' },
      { type: 'action', text: '[VISUAL: The artist stands in the doorway under flickering neon magenta lights.]' }
    ]
  },
  {
    id: 'documentary',
    name: 'Documentary Script (A-Roll / B-Roll Format)',
    description: 'Double format capturing interview transcripts (A-Roll) and overlay footage (B-Roll).',
    targetPageCount: 40,
    estimatedRuntimeMin: 50,
    nodes: [
      { type: 'sceneHeading', text: 'INT. EXPERT OFFICE - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[A-ROLL INTERVIEW: Dr. Aris speaks directly to camera.]' },
      { type: 'character', text: 'DR. ARIS' },
      { type: 'dialogue', text: 'The ecosystem began shifting rapidly in the late summer of 2024.' },
      { type: 'action', text: '[B-ROLL FOOTAGE: Drone shots of melting glaciers and dry riverbeds.]' }
    ]
  },
  {
    id: 'youtube-essay',
    name: 'Video Essay / YouTube Script',
    description: 'Structured for online viewer retention, screen graphics, overlays, sound effects, and calls to action.',
    targetPageCount: 8,
    estimatedRuntimeMin: 12,
    nodes: [
      { type: 'sceneHeading', text: 'HOOK & SCREEN GRAPHICS', id: crypto.randomUUID() },
      { type: 'action', text: '[ON-SCREEN TEXT: "Why Cinema is Dying." A fast montage of vintage film clips.]' },
      { type: 'character', text: 'NARRATOR' },
      { type: 'dialogue', text: 'In 1999, we had Matrix, Fight Club, and Magnolia. What happened?' }
    ]
  },
  {
    id: 'web-series',
    name: 'Web Series Episode',
    description: 'Quick-paced, low-budget scene setups. Perfect for serialized YouTube, Vimeo, or short-form web content.',
    targetPageCount: 6,
    estimatedRuntimeMin: 7,
    nodes: [
      { type: 'sceneHeading', text: 'INT. DORM ROOM - DAY', id: crypto.randomUUID() },
      { type: 'action', text: '[EPISODE 1: "The Wifi is Down." Setup of the central roommates conflict.]' },
      { type: 'character', text: 'ALEX' },
      { type: 'dialogue', text: 'If I don\'t submit this code in two minutes, I\'m expelled.' }
    ]
  },
  {
    id: 'animation-beat',
    name: 'Animation Script (Beat Board Format)',
    description: 'Structured around storyboard frame visual cues, character expressions, voice overlays, and sound cues.',
    targetPageCount: 20,
    estimatedRuntimeMin: 22,
    nodes: [
      { type: 'sceneHeading', text: 'FRAME 1: CLOUD CASTLE', id: crypto.randomUUID() },
      { type: 'action', text: '[BOARD DRAWING #1: A tiny pink dragon sits on a fluffy yellow cloud eating a cupcake.]' },
      { type: 'character', text: 'SPARKY' },
      { type: 'dialogue', text: 'Yum! Strawberry clouds!' }
    ]
  }
];

export function getTemplateById(id: string): ScriptTemplate | undefined {
  return PREBUILT_TEMPLATES.find((t) => t.id === id);
}
