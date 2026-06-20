export type StitchScreen = {
  slug: string;
  title: string;
  phase: "entry" | "onboarding" | "sync" | "intelligence" | "command";
  useWhen: string;
  primary: boolean;
};

export const screenLibrary: StitchScreen[] = [
  {
    slug: "welcome_to_finvault_red_theme",
    title: "Welcome to FinVault",
    phase: "entry",
    useWhen: "First impression for the hackathon demo and unauthenticated landing entry.",
    primary: true
  },
  {
    slug: "get_started_finvault",
    title: "Get Started",
    phase: "entry",
    useWhen: "After the user chooses to begin; introduces account creation and Google sign-in.",
    primary: true
  },
  {
    slug: "create_your_workspace_finvault",
    title: "Create Workspace",
    phase: "onboarding",
    useWhen: "After sign-in; captures organization context before finance sync begins.",
    primary: true
  },
  {
    slug: "you_re_in_finvault",
    title: "Workspace Ready",
    phase: "onboarding",
    useWhen: "Confirmation screen after organization setup succeeds.",
    primary: true
  },
  {
    slug: "your_financial_snapshot",
    title: "Financial Snapshot",
    phase: "onboarding",
    useWhen: "Initial baseline before connections; frames what FinVault will build from source data.",
    primary: true
  },
  {
    slug: "business_discovery",
    title: "Business Discovery",
    phase: "sync",
    useWhen: "Start of discovery after workspace setup; asks what business data to connect.",
    primary: true
  },
  {
    slug: "business_discovery_finvault",
    title: "Discovery Detail",
    phase: "sync",
    useWhen: "Deeper discovery state while classifying business model, customers, and finance structure.",
    primary: true
  },
  {
    slug: "syncing_data",
    title: "Syncing Data",
    phase: "sync",
    useWhen: "Immediately after Zoho, Gmail, or document connections are authorized.",
    primary: true
  },
  {
    slug: "intelligent_data_syncing",
    title: "Intelligent Data Sync",
    phase: "sync",
    useWhen: "While FinVault normalizes records and builds source-backed entities.",
    primary: true
  },
  {
    slug: "building_your_ai_cfo_finvault",
    title: "Building AI CFO",
    phase: "sync",
    useWhen: "Processing state after sync; rules engine, graph, and validation layers are being prepared.",
    primary: true
  },
  {
    slug: "relationship_mapping_finvault_intelligence",
    title: "Relationship Mapping",
    phase: "intelligence",
    useWhen: "After normalized records exist; shows customer, invoice, payment, vendor, and email links.",
    primary: true
  },
  {
    slug: "customer_intelligence_nexus_global",
    title: "Customer Intelligence",
    phase: "intelligence",
    useWhen: "Customer drill-down view after graph mapping; useful for receivables and relationship context.",
    primary: true
  },
  {
    slug: "financial_health_dashboard",
    title: "Financial Health Dashboard",
    phase: "command",
    useWhen: "Main executive dashboard once the financial graph and rules engine are ready.",
    primary: true
  },
  {
    slug: "cash_flow_intelligence",
    title: "Cash Flow Intelligence",
    phase: "command",
    useWhen: "Cash position, inflow, outflow, burn, and runway analysis from calculated metrics.",
    primary: true
  },
  {
    slug: "risk_center",
    title: "Risk Center",
    phase: "command",
    useWhen: "Risk triage view for alerts generated from thresholds and supporting evidence.",
    primary: true
  },
  {
    slug: "risk_discovery_intelligence_engine",
    title: "Risk Discovery Engine",
    phase: "command",
    useWhen: "Automated risk discovery moment; best used before showing the Ask FinVault briefing.",
    primary: true
  },
  {
    slug: "ask_finvault_ai_cfo_executive_briefing",
    title: "Ask FinVault",
    phase: "command",
    useWhen: "Validated Q&A surface after calculations and evidence are available.",
    primary: true
  },
  {
    slug: "ai_cfo_ready_finvault",
    title: "AI CFO Ready",
    phase: "command",
    useWhen: "Final readiness and success state at the end of onboarding or demo narrative.",
    primary: true
  },
  {
    slug: "welcome_to_finvault",
    title: "Alternate Welcome",
    phase: "entry",
    useWhen: "Alternate clean welcome screen for a non-red-theme landing variant, not the primary demo path.",
    primary: false
  }
];

export const stitchScreens = screenLibrary.filter((screen) => screen.primary);
